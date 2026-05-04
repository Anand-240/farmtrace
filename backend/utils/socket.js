'use strict';

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const logger = require('./logger').child({ module: 'socket' });

// phone → Set<socket>  (supports multiple tabs / devices per user)
const userSockets = new Map();
let io = null;

function initSocketServer(httpServer) {
  const allowedOrigins = (
    process.env.FRONTEND_URL ||
    'https://farmtrace-bay.vercel.app,http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173'
  )
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  io = new Server(httpServer, {
    cors: { origin: allowedOrigins, credentials: true },
    transports: ['websocket', 'polling']
  });

  // Auth middleware — client must pass JWT in socket.handshake.auth.token
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('auth/no-token'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userPhone = decoded.phone;
      next();
    } catch {
      next(new Error('auth/invalid-token'));
    }
  });

  io.on('connection', (socket) => {
    const phone = socket.userPhone;
    if (!userSockets.has(phone)) userSockets.set(phone, new Set());
    userSockets.get(phone).add(socket);
    logger.info({ phone, id: socket.id }, 'WS connected');

    socket.on('disconnect', () => {
      const socks = userSockets.get(phone);
      socks?.delete(socket);
      if (socks?.size === 0) userSockets.delete(phone);
      logger.info({ phone, id: socket.id }, 'WS disconnected');
    });
  });

  return io;
}

function pushToUser(phone, event, payload) {
  const socks = userSockets.get(String(phone));
  if (!socks?.size) return;
  for (const sock of socks) sock.emit(event, payload);
}

module.exports = { initSocketServer, pushToUser };
