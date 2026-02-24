'use strict';

/**
 * models/GameHistoryDoc.js
 * Mongoose schema for completed game records.
 * Written once at game_over — never modified.
 */

const { Schema, model } = require('mongoose');

const PlayerResultSchema = new Schema({
    name: { type: String, required: true },
    role: { type: String, required: true },
    alive: { type: Boolean, required: true },
    isHost: { type: Boolean, default: false }
}, { _id: false });

const GameHistorySchema = new Schema({
    roomCode: { type: String, required: true, index: true },

    winner: {
        type: String,
        enum: ['VILLAGERS_WIN', 'MAFIA_WIN'],
        required: true
    },

    players: [PlayerResultSchema],

    stats: {
        rounds: { type: Number, default: 0 },
        nightKills: [String],
        eliminated: [String]
    },

    playerCount: { type: Number },

    completedAt: { type: Date, default: Date.now }
});

module.exports = model('GameHistory', GameHistorySchema);
