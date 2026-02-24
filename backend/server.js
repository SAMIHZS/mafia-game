'use strict';

/**
 * Mafia Game Backend - Main Entry Point
 *
 * Wires up Express HTTP + Socket.IO server.
 * Phase 1: health check, room creation REST endpoint, basic socket handling.
 * Phase 2: Full game logic (night/day phases, voting, win conditions).
 */

require('dotenv').config();

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const logger = require('./utils/logger');
const { errorHandler } = require('./middleware/error-handler');
const roomManager = require('./services/room-manager');
const { registerSocketEvents } = require('./config/socket-events');

// ─── App Setup ───────────────────────────────────────────────────────────────
const app = express();
const httpServer = createServer(app);

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8080';
const PORT = process.env.PORT || 3001;
const IS_DEV = (process.env.NODE_ENV || 'development') === 'development';

/**
 * CORS origin resolver.
 * - Development: allow any localhost origin (any port — http-server, Vite, Live Server, etc.)
 * - Production: allow only the configured FRONTEND_URL
 */
function corsOrigin(origin, callback) {
  // Allow requests with no origin (curl, Postman, same-origin)
  if (!origin) return callback(null, true);

  if (IS_DEV && /^http:\/\/localhost(:\d+)?$/.test(origin)) {
    return callback(null, true);
  }
  if (origin === FRONTEND_URL) {
    return callback(null, true);
  }

  callback(new Error(`CORS: Origin not allowed — ${origin}`));
}

const corsOptions = { origin: corsOrigin, credentials: true, methods: ['GET', 'POST', 'OPTIONS'] };

// ─── Socket.IO Server ────────────────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: corsOptions,
  pingInterval: 25000,
  pingTimeout: 60000,
  transports: ['websocket', 'polling'] // Fallback to polling if WebSocket unavailable
});

// ─── Express Middleware ───────────────────────────────────────────────────────
app.use(cors(corsOptions));          // handles OPTIONS preflight automatically
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ─── REST Endpoints ──────────────────────────────────────────────────────────

/**
 * GET /api/health
 * Health check endpoint. Returns server status.
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    rooms: roomManager.getRoomCount()
  });
});

/**
 * POST /api/room
 * Create a new game room.
 * Returns: { roomCode, createdAt }
 *
 * Phase 2: Add optional settings (nightDuration, dayDuration, enableDoctor, etc.)
 */
app.post('/api/room', (req, res) => {
  try {
    const room = roomManager.createRoom();
    logger.info(`Room created via REST: ${room.roomId}`);

    res.status(201).json({
      roomCode: room.roomId,
      createdAt: room.createdAt
    });
  } catch (err) {
    logger.error('Failed to create room', err);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

/**
 * GET /api/room/:code
 * Get public info about a room (Phase 2).
 */
app.get('/api/room/:code', (req, res) => {
  const room = roomManager.findRoom(req.params.code.toUpperCase());
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  // Only return public fields — never expose roles!
  res.json(room.toPublicJSON());
});

// ─── Socket.IO Event Handlers ─────────────────────────────────────────────────
// Delegates all socket events to config/socket-events.js
registerSocketEvents(io, roomManager);

// ─── Error Handling ───────────────────────────────────────────────────────────
app.use(errorHandler);

// ─── 404 Fallback ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  logger.info(`🎮 Mafia Game Server running on port ${PORT}`);
  logger.info(`📡 Accepting connections from: ${FRONTEND_URL}`);
  logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = { app, httpServer, io };
