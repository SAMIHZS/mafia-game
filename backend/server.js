'use strict';

/**
 * Mafia Game Backend — Main Entry Point
 *
 * Phase 3: MongoDB persistence, JWT auth, /api/stats endpoint.
 * Wires up Express HTTP + Socket.IO server.
 */

require('dotenv').config();

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');

const logger = require('./utils/logger');
const { errorHandler } = require('./middleware/error-handler');
const db = require('./services/db');
const roomManager = require('./services/room-manager');
const GameHistoryDoc = require('./models/GameHistoryDoc');
const { registerSocketEvents } = require('./config/socket-events');
const { isDbConnected } = require('./services/db');

// ─── App Setup ────────────────────────────────────────────────────────────────
const app = express();
const httpServer = createServer(app);

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8080';
const PORT = process.env.PORT || 3001;
const IS_DEV = (process.env.NODE_ENV || 'development') === 'development';

// ─── CORS ─────────────────────────────────────────────────────────────────────
function corsOrigin(origin, callback) {
  if (!origin) return callback(null, true);
  if (IS_DEV && /^http:\/\/localhost(:\d+)?$/.test(origin)) return callback(null, true);
  if (origin === FRONTEND_URL) return callback(null, true);
  callback(new Error(`CORS: Origin not allowed — ${origin}`));
}

const corsOptions = {
  origin: corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS']
};

// ─── Socket.IO ────────────────────────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: corsOptions,
  pingInterval: 25000,
  pingTimeout: 60000,
  transports: ['websocket', 'polling']
});

// ─── Express Middleware ────────────────────────────────────────────────────────

// Security headers (CRIT-01)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "cdn.jsdelivr.net", "cdn.tailwindcss.com"],
      connectSrc: ["'self'", "wss:", "ws:", FRONTEND_URL],
      imgSrc: ["'self'", "data:", "images.unsplash.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "cdn.tailwindcss.com", "fonts.googleapis.com"],
      fontSrc: ["'self'", "fonts.gstatic.com"]
    }
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  frameguard: { action: 'deny' },
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

app.use(cors(corsOptions));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));
app.use(hpp());

// Global rate limiter (CRIT-02)
const globalLimiter = rateLimit({ windowMs: 60000, max: 60, message: { error: 'Too many requests' } });
app.use('/api/', globalLimiter);

// Per-route rate limiters
const roomCreateLimiter = rateLimit({ windowMs: 300000, max: 5, message: { error: 'Too many room creations' } });
const roomLookupLimiter = rateLimit({ windowMs: 60000, max: 20, message: { error: 'Too many lookups' } });

// ─── REST Endpoints ───────────────────────────────────────────────────────────

/** GET /api/health */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    rooms: roomManager.getRoomCount(),
    db: isDbConnected() ? 'connected' : 'memory-only'
  });
});

/** POST /api/room — Create a new game room */
app.post('/api/room', roomCreateLimiter, async (req, res) => {
  try {
    const room = await roomManager.createRoom();
    logger.info(`Room created via REST: ${room.roomId}`);
    res.status(201).json({ roomCode: room.roomId, createdAt: room.createdAt });
  } catch (err) {
    logger.error('Failed to create room', err);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

/** GET /api/room/:code — Public room info */
app.get('/api/room/:code', roomLookupLimiter, (req, res) => {
  const room = roomManager.findRoom(req.params.code.toUpperCase());
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json(room.toPublicJSON());
});

/**
 * GET /api/stats — Live server statistics (Phase 3)
 * Returns: active rooms, online players, total games completed.
 */
app.get('/api/stats', async (req, res) => {
  try {
    const activeRooms = roomManager.getRoomCount();

    // Count unique connected sockets across all live game rooms
    let onlinePlayers = 0;
    if (io.sockets.adapter.rooms) {
      for (const [, sockets] of io.sockets.adapter.rooms) {
        // Socket.IO also creates a room per socket id — skip those (size === 1 & key is a socket id)
        // Real rooms have codes like 'ABCD1234' (length 8)
        if (sockets.size > 1) onlinePlayers += sockets.size;
      }
    }

    const gamesCompleted = isDbConnected()
      ? await GameHistoryDoc.countDocuments()
      : 0;

    res.json({
      activeRooms,
      onlinePlayers,
      gamesCompleted,
      dbConnected: isDbConnected(),
      uptime: Math.floor(process.uptime())
    });
  } catch (err) {
    logger.error('/api/stats error', err);
    res.status(500).json({ error: 'Stats unavailable' });
  }
});

// ─── Socket.IO Event Handlers ────────────────────────────────────────────────
registerSocketEvents(io, roomManager);

// ─── Error Handling ───────────────────────────────────────────────────────────
app.use(errorHandler);
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// ─── Startup ──────────────────────────────────────────────────────────────────
async function start() {
  // Connect to MongoDB (non-blocking — server starts either way)
  await db.connect();

  // Restore waiting-lobby rooms from DB into memory
  await roomManager.restoreRoomsFromDB();

  httpServer.listen(PORT, () => {
    logger.info(`🎮 Mafia Server running on port ${PORT}`);
    logger.info(`📡 Accepting connections from: ${FRONTEND_URL}`);
    logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`🗄️  Database: ${isDbConnected() ? 'MongoDB connected' : 'Memory-only mode'}`);
  });
}

start().catch(err => {
  logger.error('Startup error', err);
  process.exit(1);
});

// ─── Graceful Shutdown ────────────────────────────────────────────────────────
function gracefulShutdown(signal) {
  logger.info(`${signal} received — shutting down gracefully...`);

  // Stop accepting new connections
  httpServer.close(() => {
    logger.info('HTTP server closed');
  });

  // Close all Socket.IO connections
  io.close(() => {
    logger.info('Socket.IO connections closed');
  });

  // Close MongoDB connection
  const mongoose = require('mongoose');
  mongoose.connection.close(false).then(() => {
    logger.info('MongoDB connection closed');
    process.exit(0);
  }).catch(() => {
    process.exit(1);
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = { app, httpServer, io };
