require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');

const app = express();
let mongoState = 'connecting';

// Get allowed origins from environment
const frontendURLs = (process.env.FRONTEND_URL || 'https://farmtrace-bay.vercel.app,http://localhost:3000')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

console.log('🌾 FarmTrace Backend Starting...');
console.log('✅ Allowed CORS Origins:', frontendURLs);

// Security Middlewares
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(mongoSanitize());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later'
});
app.use('/api/', apiLimiter);

// CORS Configuration - more permissive for development
const corsOptions = {
  origin(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc)
    if (!origin) {
      console.log('✅ CORS: Request without origin allowed');
      return callback(null, true);
    }

    // Check if origin is in allowed list
    if (frontendURLs.includes(origin)) {
      console.log(`✅ CORS: ${origin} allowed`);
      return callback(null, true);
    }

    // Log but allow (for development)
    console.warn(`⚠️  CORS: Origin ${origin} not in allowlist, but allowing for development`);
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  optionsSuccessStatus: 200,
  maxAge: 86400 // 24 hours
};

app.use(cors(corsOptions));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  const isMongoConnected = mongoose.connection.readyState === 1;
  res.status(isMongoConnected ? 200 : 503).json({
    status: isMongoConnected ? 'ok' : 'degraded',
    database: mongoState,
    message: 'FarmTrace backend is running',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/produce', require('./routes/produce'));
app.use('/api/transfer', require('./routes/transfer'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/payment', require('./routes/payment'));

// Catch-all for 404
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.path });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ FarmTrace Backend running on port ${PORT}`);
  console.log(`📍 Version: Production`);
});

mongoose.connect(process.env.MONGO_URI, {
  tls: true,
  tlsAllowInvalidCertificates: true,
  serverSelectionTimeoutMS: 10000,
})
  .then(() => {
    mongoState = 'connected';
    console.log('MongoDB connected!');
  })
  .catch(err => {
    mongoState = 'disconnected';
    console.error('MongoDB error:', err.message);
  });
