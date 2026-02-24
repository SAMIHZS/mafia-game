'use strict';

/**
 * services/db.js
 * Mongoose connection manager.
 * Phase 3: MongoDB Atlas persistence.
 */

const mongoose = require('mongoose');
const logger = require('../utils/logger');

let isConnected = false;

/**
 * Connect to MongoDB Atlas.
 * Idempotent — safe to call multiple times.
 */
async function connect() {
    if (isConnected) return;

    const uri = process.env.MONGODB_URI;
    if (!uri) {
        logger.info('⚠️  MONGODB_URI not set — running in memory-only mode');
        return;
    }

    try {
        await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000
        });
        isConnected = true;
        logger.info('✅ MongoDB connected');

        mongoose.connection.on('disconnected', () => {
            isConnected = false;
            logger.error('MongoDB disconnected');
        });
        mongoose.connection.on('reconnected', () => {
            isConnected = true;
            logger.info('MongoDB reconnected');
        });
    } catch (err) {
        logger.error('MongoDB connection failed — continuing in memory-only mode', err.message);
        // Do NOT crash the server — game still works in-memory
    }
}

/** Returns true if currently connected to MongoDB. */
function isDbConnected() {
    return isConnected;
}

module.exports = { connect, isDbConnected };
