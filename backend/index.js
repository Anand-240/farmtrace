require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');

const app = express();
let mongoState = 'connecting';


const frontendURLs = (process.env.FRONTEND_URL || 'https://farmtrace-bay.vercel.app,http://localhost:3000')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

console.log('Allowed CORS Origins:', frontendURLs);

// Security Middlewares
app.use(helmet());
app.use(mongoSanitize());
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later'
});
app.use('/api/', apiLimiter);

// CORS Configuration
app.use(cors({
  origin(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true);
    }

    // Check if origin is in allowed list
    if (frontendURLs.includes(origin)) {
      return callback(null, true);
    }

    // Log blocked origin for debugging
    console.warn('CORS blocked for origin:', origin);
    return callback(new Error(`CORS not allowed for origin: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
}));

// Preflight requests
app.options('*', cors({
  origin(origin, callback) {
    if (!origin || frontendURLs.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, true); // Allow preflight requests
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/produce', require('./routes/produce'));
app.use('/api/transfer', require('./routes/transfer'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/payment', require('./routes/payment'));

app.get('/health', (req, res) => {
  const isMongoConnected = mongoose.connection.readyState === 1;
  res.status(isMongoConnected ? 200 : 503).json({
    status: isMongoConnected ? 'ok' : 'degraded',
    database: mongoState,
    message: 'FarmTrace backend chal raha hai'
  });
});

app.listen(process.env.PORT || 4000, '0.0.0.0', () => {
  console.log(`Server port ${process.env.PORT || 4000} pe chal raha hai`);
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
