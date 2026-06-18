import express from 'express';
import cors from 'cors';
import apiRoutes from './routes/api.js';
import {
    securityHeaders,
    generalLimiter,
    preventParameterPollution,
    sanitizeInput,
    corsOptions,
    securityLogger,
    contentSizeLimiter
} from '../middleware/security.js';

const app = express();

// Security Middleware
app.use(securityHeaders);
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(contentSizeLimiter);
app.use(preventParameterPollution);
app.use(sanitizeInput);
app.use(securityLogger);
app.use(generalLimiter);

// Health Check
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Attach IO to request if available (will be set in index.js)
app.use((req, res, next) => {
    req.io = app.get('io');
    next();
});

// API Routes
app.use('/api', apiRoutes);

// Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

export default app;
