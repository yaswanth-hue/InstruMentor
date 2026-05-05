import { createClient } from 'redis';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../config/.env') });

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT || 6379;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || '';

const client = createClient({
    socket: {
        host: REDIS_HOST,
        port: parseInt(REDIS_PORT)
    },
    password: REDIS_PASSWORD || undefined
});

let isConnected = false;

client.on('error', (err) => {
    if (!isConnected) {
        console.warn('⚠️  Redis connection unavailable - Running in degraded mode (some features may be limited)');
    } else {
        console.error('Redis Error:', err);
    }
});

client.on('connect', () => {
    isConnected = true;
    console.log('✅ Redis connected');
});

// Create separate clients for Pub/Sub (Socket.IO adapter)
const pubClient = client.duplicate();
const subClient = client.duplicate();

export const connectRedis = async () => {
    try {
        await Promise.all([
            client.connect(),
            pubClient.connect(),
            subClient.connect()
        ]);
        return true;
    } catch (err) {
        console.warn('Failed to connect to Redis, proceeding without persistence.');
        return false;
    }
};

export { client, pubClient, subClient };
