'use strict';

/**
 * middleware/error-handler.js
 * Express global error handling middleware.
 */

const logger = require('../utils/logger');

/**
 * Express error handler (must have 4 args).
 * Catches errors thrown from route handlers.
 */
function errorHandler(err, req, res, next) {
    logger.error(`HTTP Error: ${err.message}`, err);

    const statusCode = err.statusCode || err.status || 500;
    const message = process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message;

    res.status(statusCode).json({
        error: message,
        status: statusCode,
        // Never expose stack traces in production
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    });
}

module.exports = { errorHandler };
