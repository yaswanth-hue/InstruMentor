import { stateService } from '../services/stateService.js';

export const registerChatHandlers = (io, socket) => {

    socket.on('send-message', async (data) => {
        const { roomId, userId, userName, message, messageType = 'public', recipientId = null, mediaUrl = null, mediaData = null, fileName = null, fileSize = null, mimeType = null } = data;

        // Check if room/participants exist
        const participants = await stateService.getParticipants(roomId);
        const room = await stateService.getRoom(roomId);
        const meeting = await stateService.getMeeting(roomId);

        const validContext = (participants.length > 0) || room || meeting;

        if (!validContext) {
            socket.emit('message-error', 'Room not found');
            return;
        }

        // Check permissions
        if (room && !room.allow_chat) {
            socket.emit('message-error', 'Chat is disabled in this room');
            return;
        }

        const chatMessage = {
            id: Date.now().toString(),
            roomId,
            userId,
            userName,
            message,
            messageType,
            recipientId,
            mediaUrl,
            mediaData,
            fileName,
            fileSize,
            mimeType,
            createdAt: new Date().toISOString()
        };

        await stateService.addMessage(roomId, chatMessage);

        if (messageType === 'private' && recipientId) {
            // Send to sender
            socket.emit('new-message', chatMessage);

            // Send to recipient
            // We need to find the socket ID of the recipient.
            // We can use io.in(roomId).fetchSockets() but that's expensive for every msg.
            // We can assume recipient is in the room.
            // Broadcast to a specific socket in the room.

            // Optimization: Look up participant in state
            const recipient = participants.find(p => p.userId === recipientId);
            if (recipient && recipient.socketId) {
                io.to(recipient.socketId).emit('new-message', chatMessage);
            }
        } else {
            io.to(roomId).emit('new-message', chatMessage);
        }
    });

    socket.on('toggle-chat-lock', async ({ roomId, locked }) => {
        // Just broadcast event for now, can perform state update if we add chatLocked to room model
        io.to(roomId).emit('chat-locked', { locked });
    });

    socket.on('send-reaction', ({ roomId, userId, reaction }) => {
        io.to(roomId).emit('reaction-sent', { userId, reaction });
    });
};
