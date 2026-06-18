import { stateService } from '../services/stateService.js';

export const registerRoomHandlers = (io, socket) => {

    // Join Room
    socket.on('join-room', async ({ roomId, userId, userName, userEmail, isHost = false }) => {
        const isLocked = await stateService.isRoomLocked(roomId);
        if (isLocked) {
            socket.emit('room-entry-denied', { reason: 'locked' });
            return;
        }

        console.log(`${userName} (${userEmail}) joining room ${roomId}`);

        const existingSession = await stateService.getUserSession(userEmail);
        if (existingSession && existingSession.isActive && existingSession.socketId !== socket.id) {
            socket.emit('action-error', 'You are already in a meeting session from another device.');
            return;
        }

        socket.join(roomId);
        socket.userId = userId;
        socket.userName = userName;
        socket.userEmail = userEmail;
        socket.roomId = roomId;
        socket.isHost = isHost;

        await stateService.setUserSession(userEmail, {
            socketId: socket.id,
            userId,
            userName,
            roomId,
            isActive: true,
            joinedAt: new Date().toISOString()
        });

        const currentParticipants = await stateService.getParticipants(roomId);

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
            io.to(roomId).emit('participant-joined', participant);

            const updatedParticipants = await stateService.getParticipants(roomId);
            io.to(roomId).emit('participants-updated', updatedParticipants);

            // Broadcast updated participant count to the global room list listeners
            io.emit('room-participant-count', { roomId, count: updatedParticipants.length });
        } else {
            console.log(`Participant ${userId} already in room ${roomId} (reconnect)`);
        }

        const participants = await stateService.getParticipants(roomId);
        socket.emit('participants-updated', participants);

        const messages = await stateService.getMessages(roomId);
        socket.emit('chat-history', messages);

        const meeting = await stateService.getMeeting(roomId);
        if (meeting) {
            socket.emit('meeting-materials', meeting.materials || []);
        }
    });

    // Leave Room
    socket.on('leave-room', async ({ roomId, userId }) => {
        await handleLeaveRoom(io, socket, roomId, userId);
    });

    // Disconnect
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
            await stateService.addParticipant(roomId, participant);
            io.to(roomId).emit('participant-muted', { userId, isMuted });
            io.to(roomId).emit('participants-updated', participants);
        }
    });

    socket.on('raise-hand', async ({ roomId, userId, raised }) => {
        const participants = await stateService.getParticipants(roomId);
        const participant = participants.find(p => p.userId === userId);

        if (participant) {
            participant.isHandRaised = raised !== undefined ? raised : !participant.isHandRaised;
            await stateService.addParticipant(roomId, participant);
            io.to(roomId).emit('hand-raised', { userId, raised: participant.isHandRaised });
            io.to(roomId).emit('participants-updated', participants);
        }
    });

    // Host Controls
    socket.on('host-mute-participant', async ({ roomId, targetUserId, isMuted, hostId }) => {
        const room = await stateService.getRoom(roomId);
        const meeting = await stateService.getMeeting(roomId);
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

        await stateService.updateRoom(roomId, { allow_media });
        io.to(roomId).emit('room-media-settings-updated', { allow_media });
    });

    // Host lock/unlock room
    socket.on('host-lock-room', async ({ roomId, hostId, lock }) => {
        const room = await stateService.getRoom(roomId);
        if (!room || room.host_id !== hostId) {
            socket.emit('action-error', 'Only the host can lock this room');
            return;
        }

        await stateService.setRoomLocked(roomId, lock);
        io.to(roomId).emit('room-lock-status', { lock });
    });

    // Host ends room for everyone
    socket.on('end-room', async ({ roomId }) => {
        const room = await stateService.getRoom(roomId);
        // Broadcast room-closed to everyone in the room
        io.to(roomId).emit('room-closed', { roomId });
        // Clean up
        await stateService.deleteRoom(roomId);
        // Broadcast globally so the list page removes this room
        io.emit('room-deleted', { roomId });
    });

    socket.on('update-permissions', ({ roomId, settings }) => {
        io.to(roomId).emit('permissions-updated', settings);
    });
};

// Helper for leaving room
async function handleLeaveRoom(io, socket, roomId, userId) {
    console.log(`${userId} leaving room ${roomId}`);

    if (socket.userEmail) {
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

    // Broadcast updated count to list page
    io.emit('room-participant-count', { roomId, count: remaining.length });

    socket.leave(roomId);

    if (remaining.length === 0) {
        console.log(`Room ${roomId} is empty. Scheduling deletion check...`);
        setTimeout(async () => {
            const participants = await stateService.getParticipants(roomId);
            if (participants.length === 0) {
                console.log(`Deleting empty room ${roomId}`);
                await stateService.deleteRoom(roomId);
                io.emit('room-deleted', { roomId });
            }
        }, 30000);
    }
}