import { stateService } from '../services/stateService.js';

export const registerRoomHandlers = (io, socket) => {

    // Join Room
    socket.on('join-room', async ({ roomId, userId, userName, userEmail, isHost = false }) => {
        const isLocked = await stateService.isRoomLocked(roomId);
        if (isLocked) {
            socket.emit('action-error', 'Room is locked by the host.');
            return;
        }

        console.log(`${userName} (${userEmail}) joining room ${roomId}`);

        // Check for existing session from another device
        const existingSession = await stateService.getUserSession(userEmail);
        if (existingSession && existingSession.isActive && existingSession.socketId !== socket.id) {
            socket.emit('action-error', 'You are already in a meeting session from another device.');
            return;
        }

        socket.join(roomId);

        // Attach user info to socket instance for easy access in other handlers
        socket.userId = userId;
        socket.userName = userName;
        socket.userEmail = userEmail;
        socket.roomId = roomId;
        socket.isHost = isHost;

        // Save session
        await stateService.setUserSession(userEmail, {
            socketId: socket.id,
            userId,
            userName,
            roomId,
            isActive: true,
            joinedAt: new Date().toISOString()
        });

        // Add to participants list
        const currentParticipants = await stateService.getParticipants(roomId);

        // Check for duplicate session strictly within the room (double safety)
        const duplicateSession = currentParticipants.find(p => p.userEmail === userEmail && p.userId !== userId);
        if (duplicateSession) {
            socket.emit('duplicate-session', { message: 'You are already in this meeting from another device' });
            return;
        }

        const existingParticipant = currentParticipants.find(p => p.userId === userId);

        if (!existingParticipant) {
            const participant = {
                userId,
                userName,
                userEmail,
                isHost,
                isMuted: false,
                hasVideo: false,
                isHandRaised: false,
                joinedAt: new Date().toISOString(),
                socketId: socket.id
            };

            await stateService.addParticipant(roomId, participant);
            console.log(`Added participant ${userId} to room ${roomId}`);

            // Notify room
            io.to(roomId).emit('participant-joined', participant);

            // Get updated list to send to everyone
            const updatedParticipants = await stateService.getParticipants(roomId);
            io.to(roomId).emit('participants-updated', updatedParticipants);
        } else {
            console.log(`Participant ${userId} already in room ${roomId} (reconnect)`);
        }

        // Send current state to new user
        const participants = await stateService.getParticipants(roomId);
        socket.emit('participants-updated', participants);

        const messages = await stateService.getMessages(roomId);
        socket.emit('chat-history', messages);

        // If it's a course meeting, send materials
        const meeting = await stateService.getMeeting(roomId);
        if (meeting) {
            socket.emit('meeting-materials', meeting.materials || []);
        }
    });

    // Leave Room
    socket.on('leave-room', async ({ roomId, userId }) => {
        await handleLeaveRoom(io, socket, roomId, userId);
    });

    // Disconnect (handle abrupt disconnects)
    socket.on('disconnect', async () => {
        if (socket.roomId && socket.userId) {
            console.log(`Client disconnected: ${socket.userId}`);
            await handleLeaveRoom(io, socket, socket.roomId, socket.userId);
        }
    });

    // Participant Controls
    socket.on('toggle-mute', async ({ roomId, userId, isMuted }) => {
        const participants = await stateService.getParticipants(roomId);
        const participant = participants.find(p => p.userId === userId);

        if (participant) {
            participant.isMuted = isMuted;
            await stateService.addParticipant(roomId, participant); // Update in Redis

            io.to(roomId).emit('participant-muted', { userId, isMuted });
            io.to(roomId).emit('participants-updated', participants);
        }
    });

    socket.on('raise-hand', async ({ roomId, userId, raised }) => {
        const participants = await stateService.getParticipants(roomId);
        const participant = participants.find(p => p.userId === userId);

        if (participant) {
            participant.isHandRaised = raised !== undefined ? raised : !participant.isHandRaised;
            await stateService.addParticipant(roomId, participant); // Update

            io.to(roomId).emit('hand-raised', { userId, raised: participant.isHandRaised });
            io.to(roomId).emit('participants-updated', participants);
        }
    });

    // Host Controls
    socket.on('host-mute-participant', async ({ roomId, targetUserId, isMuted, hostId }) => {
        const room = await stateService.getRoom(roomId);
        const meeting = await stateService.getMeeting(roomId);

        // Host check: handle both ad-hoc rooms and scheduled meetings
        const actualHostId = room ? room.host_id : (meeting ? meeting.hostId : null);

        if (actualHostId !== hostId) {
            socket.emit('action-error', 'Only the host can mute participants');
            return;
        }

        const participants = await stateService.getParticipants(roomId);
        const participant = participants.find(p => p.userId === targetUserId);

        if (participant) {
            participant.isMuted = isMuted;
            await stateService.addParticipant(roomId, participant);

            // Notify specific user
            const targetSocket = (await io.in(roomId).fetchSockets()).find(s => s.userId === targetUserId);
            if (targetSocket) {
                targetSocket.emit('host-action', {
                    action: isMuted ? 'muted' : 'unmuted',
                    message: `You have been ${isMuted ? 'muted' : 'unmuted'} by the host`
                });
            }

            io.to(roomId).emit('participant-muted', { userId: targetUserId, isMuted });
            io.to(roomId).emit('participants-updated', participants);
        }
    });

    socket.on('host-set-media-permissions', async ({ roomId, hostId, allow_media }) => {
        const room = await stateService.getRoom(roomId);
        if (!room || room.host_id !== hostId) {
            socket.emit('action-error', 'Only the host can change permissions');
            return;
        }

        room.allow_media = allow_media;
        await stateService.updateRoom(roomId, { allow_media });
        io.to(roomId).emit('room-media-settings-updated', { allow_media });
    });

    socket.on('update-permissions', ({ roomId, settings }) => {
        io.to(roomId).emit('permissions-updated', settings);
    });
};

// Helper for leaving room (shared between explicit leave and disconnect)
async function handleLeaveRoom(io, socket, roomId, userId) {
    console.log(`${userId} leaving room ${roomId}`);

    if (socket.userEmail) {
        // We set active to false instead of removing, to avoid race conditions with reconnects
        // or removing just completely.
        const session = await stateService.getUserSession(socket.userEmail);
        if (session) {
            session.isActive = false;
            await stateService.setUserSession(socket.userEmail, session);
        }
    }

    await stateService.removeParticipant(roomId, userId);

    io.to(roomId).emit('participant-left', { userId });

    const remaining = await stateService.getParticipants(roomId);
    io.to(roomId).emit('participants-updated', remaining);

    socket.leave(roomId);

    // Auto-close empty rooms logic
    if (remaining.length === 0) {
        console.log(`Room ${roomId} is empty. Scheduling deletion check...`);

        setTimeout(async () => {
            const participants = await stateService.getParticipants(roomId);
            if (participants.length === 0) {
                console.log(`Deleting empty room ${roomId}`);
                await stateService.deleteRoom(roomId);
                io.to(roomId).emit('room-closed', { roomId });
            }
        }, 30000);
    }
}
