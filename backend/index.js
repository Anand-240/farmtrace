require('dotenv').config();

// ── Sentry must be initialized FIRST before any other require ──────────────
const Sentry = require('@sentry/node');
const http = require('http');
Sentry.init({
  dsn: process.env.SENTRY_DSN || '',
  enabled: Boolean(process.env.SENTRY_DSN),
  environment: process.env.NODE_ENV || 'development',
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  // Capture unhandled promise rejections automatically
  integrations: [Sentry.captureConsoleIntegration({ levels: ['error'] })],
});

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const logger = require('./utils/logger');
const { pool: pgPool } = require('./prisma/client');
const { pingRedis } = require('./utils/queue');
require('./workers/blockchainWorker'); // Start background workers
const { initSocketServer } = require('./utils/socket');

// Validate Environment Variables
const envSchema = z.object({
  MONGO_URI: z.string().min(1, 'MONGO_URI is required'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  PORT: z.string().optional().default('4000'),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  FRONTEND_URL: z.string().optional()
});

const envParsed = envSchema.safeParse(process.env);
if (!envParsed.success) {
  logger.fatal({ errors: envParsed.error.format() }, '❌ Environment validation failed');
  process.exit(1);
}

const app = express();
let mongoState = 'connecting';
let postgresState = 'connecting';
let redisState = 'connecting';

const frontendURLs = [
  ...(process.env.FRONTEND_URL || 'https://farmtrace-bay.vercel.app,http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean),
  ...(process.env.ADMIN_PANEL_URL ? [process.env.ADMIN_PANEL_URL.trim()] : [])
];

const isLocalhostOrigin = (origin = '') => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || frontendURLs.indexOf(origin) !== -1 || isLocalhostOrigin(origin) || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'x-admin-key']
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

// Strict CSP Headers with Helmet
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  // Google Sign-In popup uses postMessage to return the credential;
  // same-origin COOP blocks it — must be unsafe-none for GSI to work.
  crossOriginOpenerPolicy: { policy: 'unsafe-none' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://accounts.google.com"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https://res.cloudinary.com", "https://lh3.googleusercontent.com"],
      connectSrc: ["'self'", "https:", "http:"],
      frameSrc: ["https://accounts.google.com"],
    }
  }
}));

// Block NoSQL Injection
app.use(mongoSanitize());

// Custom Rate Limiter mapping to req.user if available
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  keyGenerator: (req) => {
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      try {
        const token = req.headers.authorization.split(' ')[1];
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        return decoded.id || decoded.sub || req.ip;
      } catch (err) {
        return req.ip;
      }
    }
    return req.ip;
  },
  validate: { default: false },
  message: { error: 'Too many requests, slow down please' }
});
let lastError = null;

// For Razorpay webhook compatibility, use raw parser BEFORE express.json
app.use('/api/v1/payment/webhook', express.raw({ type: 'application/json' }));

// Keep body parser limits to 5MB
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ limit: '5mb', extended: true }));

// ── API Routes (v1) ────────────────────────────────────────────────────────
const v1Router = express.Router();

// Apply rate limiter to all v1 routes
v1Router.use(apiLimiter);

v1Router.get('/health', (req, res) => {
  const services = {
    mongodb: mongoState,
    postgres: postgresState,
    redis: redisState
  };

  const isDegraded = Object.values(services).some(state => state !== 'connected');

  res.status(isDegraded ? 503 : 200).json({
    status: isDegraded ? 'degraded' : 'ok',
    services,
    error: lastError,
    time: new Date().toISOString()
  });
});

v1Router.use('/auth', require('./routes/write/auth'));
v1Router.use('/kyc', require('./routes/write/kyc'));
v1Router.use('/produce', require('./routes/write/produce'));
v1Router.use('/transfer', require('./routes/write/transfer'));
v1Router.use('/payment', require('./routes/write/payment'));
v1Router.use('/upload', require('./routes/write/upload'));

v1Router.use('/ai', require('./routes/read/ai'));
v1Router.use('/crop-disease', require('./routes/write/cropDisease'));
v1Router.use('/market', require('./routes/read/market'));
v1Router.use('/jobs', require('./routes/read/jobs'));

app.use('/api/v1', v1Router);

// Root Welcome Route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to FarmTrace API', version: '1.0.0' });
});

app.use((req, res) => res.status(404).json({ error: 'Not Found' }));

// ── Sentry error handler MUST come before any other error handler ──────────
Sentry.setupExpressErrorHandler(app);

app.use((err, req, res, next) => {
  logger.error({ err, url: req.url, method: req.method }, 'SERVER ERROR');
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    stack: process.env.NODE_ENV === 'production' ? null : err.stack
  });
});

// ── Catch unhandled rejections / exceptions ────────────────────────────────
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled Promise Rejection');
  Sentry.captureException(reason);
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught Exception — shutting down');
  Sentry.captureException(err);
  process.exit(1);
});

const PORT = process.env.PORT || 4000;
const httpServer = http.createServer(app);
initSocketServer(httpServer);
httpServer.listen(PORT, '0.0.0.0', () => {
  logger.info({ port: PORT }, '🚀 FarmTrace backend running');
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    mongoState = 'connected';
    logger.info('✅ MongoDB connected');
  })
  .catch(err => {
    mongoState = 'error';
    lastError = err.message;
    logger.error({ err }, '❌ MongoDB connection error');
  });

// PostgreSQL Startup Check
const postgresTimeout = setTimeout(() => {
  if (postgresState === 'connecting') {
    postgresState = 'error';
    logger.error('❌ PostgreSQL connection timed out. Check your DATABASE_URL or IP whitelist.');
  }
}, 8000);

pgPool.query('SELECT 1')
  .then(() => {
    clearTimeout(postgresTimeout);
    postgresState = 'connected';
    logger.info('✅ PostgreSQL connected');
  })
  .catch(err => {
    clearTimeout(postgresTimeout);
    postgresState = 'error';
    lastError = err.message;
    logger.error({ err: err.message }, '❌ PostgreSQL connection error');
    if (err.message.includes('ECONNREFUSED') && process.env.DATABASE_URL.includes(':6543')) {
      logger.warn('TIP: Use port 5432 instead of 6543 in DATABASE_URL if connection is refused.');
    }
  });

// Redis Startup Check
pingRedis()
  .then(() => {
    redisState = 'connected';
    logger.info('✅ Redis connected');
  })
  .catch(err => {
    redisState = 'error';
    lastError = err.message;
    logger.error({ err }, '❌ Redis connection error');
  });

