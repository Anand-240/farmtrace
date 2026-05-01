require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');

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
  console.error("❌ Environment validation failed:");
  console.error(envParsed.error.format());
  process.exit(1);
}

const app = express();
let mongoState = 'connecting';

const frontendURLs = (process.env.FRONTEND_URL || 'https://farmtrace-bay.vercel.app,http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

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
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

// Strict CSP Headers with Helmet
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https://res.cloudinary.com"],
      connectSrc: ["'self'", "https:", "http:"],
    }
  }
}));

// Block NoSQL Injection
app.use(mongoSanitize());

// Custom Rate Limiter mapping to req.user if available 
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500, // Reduced from 1000 for better security
  keyGenerator: (req) => {
    // If the request has an Authorization header, try to extract the user ID
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      try {
        const token = req.headers.authorization.split(' ')[1];
        const jwt = require('jsonwebtoken'); // Ensure jsonwebtoken is accessible
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        return decoded.id || decoded.sub || req.ip;
      } catch (err) {
        return req.ip;
      }
    }
    return req.ip;
  },
  message: { error: 'Too many requests, slow down please' }
});
app.use('/api/', apiLimiter);

// For Razorpay webhook compatibility, use raw parser BEFORE express.json if needed
app.use('/api/payment/webhook', express.raw({ type: 'application/json' }));

// Keep body parser limits to 5MB
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ limit: '5mb', extended: true }));

let lastError = null;

app.get('/health', (req, res) => {
  res.json({
    status: mongoose.connection.readyState === 1 ? 'ok' : 'error',
    database: mongoState,
    error: lastError,
    time: new Date().toISOString()
  });
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/produce', require('./routes/produce'));
app.use('/api/transfer', require('./routes/transfer'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/payment', require('./routes/payment'));
app.use('/api/market', require('./routes/market'));

app.use((req, res) => res.status(404).json({ error: 'Not Found' }));

app.use((err, req, res, next) => {
  console.error('SERVER ERROR:', err.stack);
  res.status(500).json({
    error: err.message || 'Internal Server Error',
    stack: process.env.NODE_ENV === 'production' ? null : err.stack
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    mongoState = 'connected';
    lastError = null;
    console.log('MongoDB Connected');
  })
  .catch(err => {
    mongoState = 'error';
    lastError = err.message;
    console.error('MongoDB Connection Error:', err.message);
  });
