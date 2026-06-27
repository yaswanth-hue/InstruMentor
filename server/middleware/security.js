// Security Middleware
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import hpp from 'hpp';
import { body, validationResult } from 'express-validator';

/**
 * Helmet - Security headers middleware
 * Protects against common web vulnerabilities
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://www.gstatic.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https://identitytoolkit.googleapis.com", "https://firestore.googleapis.com", "https://securetoken.googleapis.com", "wss:", "ws:"],
      frameSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false, // Required for some Firebase features
  crossOriginResourcePolicy: { policy: "cross-origin" },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  frameguard: {
    action: 'deny'
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
});

/**
 * Rate Limiter - Prevents brute force attacks
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health check
    return req.path === '/health';
  }
});

/**
 * Strict Rate Limiter - For sensitive endpoints (login, signup, etc.)
 */
export const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: 'Too many attempts from this IP, please try again after 15 minutes.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * API Rate Limiter - For API endpoints
 */
export const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 30 requests per minute
  message: 'Too many API requests, please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Socket.IO Rate Limiter - For WebSocket connections
 */
export const socketLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 60 messages per minute
  message: 'Too many messages, please slow down.',
  skipSuccessfulRequests: true,
});

/**
 * HPP - Prevents HTTP Parameter Pollution
 */
export const preventParameterPollution = hpp({
  whitelist: ['roomId', 'userId', 'courseId', 'meetingId'] // Allow array for these parameters
});

/**
 * Input Validation Middleware
 */
export const validateRoomCreation = [
  body('title').trim().isLength({ min: 3, max: 100 }).withMessage('Title must be between 3-100 characters'),
  body('description').optional().trim().isLength({ max: 500 }).withMessage('Description too long'),
  body('max_participants').optional().isInt({ min: 2, max: 100 }).withMessage('Invalid participant limit'),
  body('host_name').trim().notEmpty().withMessage('Host name is required'),
  body('password').if(body('is_private').equals(true)).isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];

export const validateMessage = [
  body('message').trim().isLength({ min: 1, max: 5000 }).withMessage('Message must be 1-5000 characters'),
  body('roomId').notEmpty().withMessage('Room ID is required'),
  body('userId').notEmpty().withMessage('User ID is required'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];

/**
 * Sanitize User Input - Remove potential XSS
 */
export const sanitizeInput = (req, res, next) => {
  // Fields that should not be sanitized (cryptographic hashes, tokens, etc.)
  const excludeFields = ['password_hash', 'token', 'hash', 'signature'];

  // Sanitize all string inputs
  const sanitizeObject = (obj) => {
    for (const key in obj) {
      // Skip sanitization for excluded fields
      if (excludeFields.includes(key)) {
        continue;
      }

      if (typeof obj[key] === 'string') {
        // Remove script tags and dangerous HTML
        obj[key] = obj[key]
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
          .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '') // Remove event handlers
          .trim();
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitizeObject(obj[key]);
      }
    }
  };

  if (req.body) sanitizeObject(req.body);
  if (req.query) sanitizeObject(req.query);
  if (req.params) sanitizeObject(req.params);

  next();
};

/**
 * Firebase Auth Token Verification Middleware
 * Optional - can be added to protect specific routes
 */
export const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    // In a real implementation, verify the Firebase ID token
    // const admin = require('firebase-admin');
    // const decodedToken = await admin.auth().verifyIdToken(token);
    // req.user = decodedToken;

    // For now, just pass through
    // You would implement actual Firebase Admin SDK verification here
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

/**
 * CORS Configuration
 */
export const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',')
      : ['http://localhost:5173', 'http://localhost:3000'];

    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400 // 24 hours
};

/**
 * Request Logger - Log suspicious activity
 */
export const securityLogger = (req, res, next) => {
  const timestamp = new Date().toISOString();
  const ip = req.ip || req.connection.remoteAddress;

  // Log suspicious patterns
  const suspiciousPatterns = [
    /(\.\.|\/etc\/|\/proc\/|\/sys\/)/i, // Directory traversal
    /(union.*select|select.*from|insert.*into|drop.*table)/i, // SQL injection
    /(<script|javascript:|onerror=|onload=)/i, // XSS attempts
  ];

  const url = req.originalUrl || req.url;
  const suspicious = suspiciousPatterns.some(pattern => pattern.test(url));

  if (suspicious) {
    console.warn(`🚨 SECURITY ALERT: ${timestamp} | IP: ${ip} | Method: ${req.method} | URL: ${url}`);
  }

  next();
};

/**
 * Socket.IO Security Middleware
 */
export const socketSecurityMiddleware = (socket, next) => {
  // Check origin
  const origin = socket.handshake.headers.origin;
  const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',')
    : ['http://localhost:5173', 'http://localhost:3000'];

  if (!origin || allowedOrigins.includes(origin)) {
    next();
  } else {
    console.warn(`🚨 Blocked Socket.IO connection from unauthorized origin: ${origin}`);
    next(new Error('Unauthorized origin'));
  }
};

/**
 * Content Size Limiter
 */
export const contentSizeLimiter = (req, res, next) => {
  const maxSize = 10 * 1024 * 1024; // 10MB

  if (req.headers['content-length'] && parseInt(req.headers['content-length']) > maxSize) {
    return res.status(413).json({ error: 'Payload too large' });
  }

  next();
};

export default {
  securityHeaders,
  generalLimiter,
  strictLimiter,
  apiLimiter,
  socketLimiter,
  preventParameterPollution,
  validateRoomCreation,
  validateMessage,
  sanitizeInput,
  verifyFirebaseToken,
  corsOptions,
  securityLogger,
  socketSecurityMiddleware,
  contentSizeLimiter
};