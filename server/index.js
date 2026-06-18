import http from 'http';
import app from './app.js';
import { initSocket } from './sockets/index.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load .env from project root (Retro/.env), with fallback to legacy config/.env location
dotenv.config({ path: path.join(__dirname, '../.env') });

const PORT = process.env.PORT || 3001;

const startServer = async () => {
    const server = http.createServer(app);
    const io = initSocket(server);
    app.set('io', io);

    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
};

startServer().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
});