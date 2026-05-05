import http from 'http';
import app from './app.js';
import { initSocket } from './sockets/index.js';
import { connectRedis } from './config/redis.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../config/.env') });

const PORT = process.env.PORT || 3001;

const startServer = async () => {
    // 1. Connect to Redis
    await connectRedis();

    // 2. Create HTTP Server
    const server = http.createServer(app);

    // 3. Initialize Socket.IO
    const io = initSocket(server);
    app.set('io', io); // Make io available in routes

    // 4. Start Server
    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
};

startServer().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
});
