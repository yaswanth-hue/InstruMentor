import { stateService } from '../services/stateService.js';

// Relays WebRTC signaling (SDP offers/answers + ICE candidates) between
// participants in the same room so peer-to-peer audio/video connections
// can be established. Without this relay, clients create RTCPeerConnections
// but their offers/answers/candidates never reach the other side, so no
// media connection is ever formed (the cause of "can't hear participants").
export const registerWebRTCHandlers = (io, socket) => {

    const relay = async (eventName, { roomId, targetUserId, ...payload }) => {
        if (!roomId || !targetUserId) return;

        const participants = await stateService.getParticipants(roomId);
        const target = participants.find(p => p.userId === targetUserId);
        if (!target?.socketId) return;

        io.to(target.socketId).emit(eventName, {
            fromUserId: socket.userId,
            ...payload
        });
    };

    socket.on('webrtc-offer', async ({ roomId, targetUserId, offer }) => {
        await relay('webrtc-offer', { roomId, targetUserId, offer });
    });

    socket.on('webrtc-answer', async ({ roomId, targetUserId, answer }) => {
        await relay('webrtc-answer', { roomId, targetUserId, answer });
    });

    socket.on('webrtc-ice-candidate', async ({ roomId, targetUserId, candidate }) => {
        await relay('webrtc-ice-candidate', { roomId, targetUserId, candidate });
    });
};