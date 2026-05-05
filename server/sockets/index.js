import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { pubClient, subClient } from '../config/redis.js';
import { registerRoomHandlers } from './roomHandler.js';
import { registerChatHandlers } from './chatHandler.js';
import { socketSecurityMiddleware, corsOptions } from '../../middleware/security.js';

export const initSocket = (httpServer) => {
    const io = new Server(httpServer, {
        cors: corsOptions,
        maxHttpBufferSize: 10 * 1024 * 1024, // 10MB
        pingTimeout: 60000,
        pingInterval: 25000,
        transports: ['websocket', 'polling'],
        allowEIO3: true,
        perMessageDeflate: false
    });

    // Use Redis adapter
    // Note: pubClient and subClient are already connected in redis.js
    io.adapter(createAdapter(pubClient, subClient));

    io.use(socketSecurityMiddleware);

    io.on('connection', (socket) => {
        // Log connection
        const clientIP = socket.handshake.address;
        // console.log(`New client connected: ${socket.id} from ${clientIP}`);

        registerRoomHandlers(io, socket);
        registerChatHandlers(io, socket);
    });

    return io;
};
