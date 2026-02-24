'use strict';

/**
 * middleware/auth.js
 * JWT token issuance and verification for secure player rejoin.
 * Phase 3 implementation.
 */

const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'mafia-dev-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    logger.error('FATAL: JWT_SECRET is not set in production. Refusing to start with insecure default.');
    process.exit(1);
}

/**
 * Issue a signed JWT for a player.
 * Stored client-side in sessionStorage for use in rejoin_room.
 *
 * @param {string} roomCode
 * @param {string} playerName
 * @param {string} socketId  - current socket ID (for traceability)
 * @returns {string} JWT token
 */
function issueToken(roomCode, playerName, socketId) {
    // NOTE: do NOT manually set `iat` — jsonwebtoken sets it automatically in seconds.
    // A manual iat in milliseconds would create a conflicting duplicate claim.
    return jwt.sign(
        { roomCode, playerName, socketId },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
}

/**
 * Verify and decode a JWT token.
 * @param {string} token
 * @returns {{ roomCode: string, playerName: string, socketId: string }}
 * @throws {Error} if token is invalid or expired
 */
function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (err) {
        throw new Error('Invalid or expired session token. Please rejoin manually.');
    }
}

/**
 * Express middleware factory (for REST routes if needed in Phase 4).
 */
function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authorization header required' });
    }
    try {
        req.user = verifyToken(authHeader.slice(7));
        next();
    } catch (err) {
        res.status(401).json({ error: err.message });
    }
}

module.exports = { issueToken, verifyToken, requireAuth };
