'use strict';

/**
 * models/RoomDoc.js
 * Mongoose schema for persisting room metadata to MongoDB.
 * In-memory Map still drives active game state — this is the durable record.
 */

const { Schema, model } = require('mongoose');

const RoomDocSchema = new Schema({
    roomCode: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true,
        index: true
    },
    hostName: { type: String, required: true },

    // Snapshot of player names (updated at join/leave in lobby)
    playerNames: [String],

    gameState: {
        type: String,
        enum: ['WAITING_LOBBY', 'ROLE_ASSIGNED', 'NIGHT_PHASE', 'DAY_PHASE', 'GAME_OVER'],
        default: 'WAITING_LOBBY'
    },

    settings: {
        nightDuration: { type: Number, default: 30 },
        dayDuration: { type: Number, default: 60 },
        minPlayers: { type: Number, default: 6 },
        maxPlayers: { type: Number, default: 20 },
        enableDoctor: { type: Boolean, default: true },
        enableDetective: { type: Boolean, default: true }
    },

    createdAt: { type: Date, default: Date.now },

    // TTL index — MongoDB auto-deletes rooms after expiry
    expiresAt: {
        type: Date,
        default: () => new Date(Date.now() + 30 * 60 * 1000), // 30 min
        index: { expireAfterSeconds: 0 }
    }
});

module.exports = model('Room', RoomDocSchema);
