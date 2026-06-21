import { Server } from 'socket.io';
import { registerRoomHandlers } from './roomHandler.js';
import { registerChatHandlers } from './chatHandler.js';
import { registerWebRTCHandlers } from './webrtcHandler.js';
import { socketSecurityMiddleware, corsOptions } from '../../middleware/security.js';

export const initSocket = (httpServer) => {
    const io = new Server(httpServer, {
        cors: corsOptions,
        maxHttpBufferSize: 10 * 1024 * 1024,
        pingTimeout: 60000,
        pingInterval: 25000,
        transports: ['websocket', 'polling'],
        allowEIO3: true,
        perMessageDeflate: false
    });

    io.use(socketSecurityMiddleware);

    io.on('connection', (socket) => {
        registerRoomHandlers(io, socket);
        registerChatHandlers(io, socket);
        registerWebRTCHandlers(io, socket);
    });

    return io;
};