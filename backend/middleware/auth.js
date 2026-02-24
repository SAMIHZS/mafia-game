'use strict';

/**
 * middleware/auth.js
 * Basic authentication middleware placeholder.
 * 
 * Phase 1: No auth required (anonymous play).
 * Phase 2: Add JWT tokens or session-based auth for player identity persistence.
 */

/**
 * Optional: Validate that a socket belongs to an active room.
 * Use as Socket.IO middleware: io.use(socketRoomAuth)
 */
function socketRoomAuth(socket, next) {
    // TODO (Phase 2): Validate JWT or session token in socket handshake
    // const token = socket.handshake.auth?.token;
    // if (!token) return next(new Error('Authentication required'));
    // jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    //   if (err) return next(new Error('Invalid token'));
    //   socket.playerId = decoded.playerId;
    //   next();
    // });

    // Phase 1: Allow all connections
    next();
}

/**
 * Express middleware: No-op for Phase 1.
 * Phase 2: Validate API keys or admin tokens.
 */
function requireAdmin(req, res, next) {
    // TODO (Phase 2): Check admin token in Authorization header
    next();
}

module.exports = { socketRoomAuth, requireAdmin };
