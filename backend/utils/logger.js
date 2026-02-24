'use strict';

/**
 * utils/logger.js
 * Centralised logging utility.
 * Outputs timestamped, levelled log lines to stdout/stderr.
 *
 * Phase 2: Replace with winston/pino for structured JSON logging.
 */

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const CURRENT_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL] ?? LOG_LEVELS.debug;

function timestamp() {
    return new Date().toISOString();
}

const logger = {
    debug(msg, data) {
        if (CURRENT_LEVEL <= LOG_LEVELS.debug) {
            console.log(`[${timestamp()}] [DEBUG] ${msg}`, data !== undefined ? data : '');
        }
    },

    info(msg, data) {
        if (CURRENT_LEVEL <= LOG_LEVELS.info) {
            console.log(`[${timestamp()}] [INFO]  ${msg}`, data !== undefined ? data : '');
        }
    },

    warn(msg, data) {
        if (CURRENT_LEVEL <= LOG_LEVELS.warn) {
            console.warn(`[${timestamp()}] [WARN]  ${msg}`, data !== undefined ? data : '');
        }
    },

    error(msg, err) {
        if (CURRENT_LEVEL <= LOG_LEVELS.error) {
            console.error(`[${timestamp()}] [ERROR] ${msg}`, err?.message || err || '');
        }
    }
};

module.exports = logger;
