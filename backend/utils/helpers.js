'use strict';

/**
 * utils/helpers.js
 * Shared utility functions.
 */

/**
 * Sleep for a given number of milliseconds.
 * @param {number} ms
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate a random alphanumeric ID (not for room codes — use room-manager for that).
 * @param {number} length
 */
function randomId(length = 8) {
    return Math.random().toString(36).substring(2, 2 + length).toUpperCase();
}

/**
 * Sanitize a player name: trim whitespace, collapse multiple spaces.
 * @param {string} name
 */
function sanitizeName(name) {
    return (name || '').trim().replace(/\s+/g, ' ');
}

/**
 * Validate a room code format: 8 alphanumeric characters.
 * @param {string} code
 */
function isValidRoomCode(code) {
    return typeof code === 'string' && /^[A-Z0-9]{8}$/.test(code.toUpperCase());
}

/**
 * Safely parse JSON, returning null on failure.
 * @param {string} str
 */
function safeJSON(str) {
    try { return JSON.parse(str); }
    catch { return null; }
}

/**
 * Pick specific keys from an object (safe projection).
 * @param {object} obj
 * @param {string[]} keys
 */
function pick(obj, keys) {
    return keys.reduce((acc, key) => {
        if (Object.prototype.hasOwnProperty.call(obj, key)) acc[key] = obj[key];
        return acc;
    }, {});
}

module.exports = { sleep, randomId, sanitizeName, isValidRoomCode, safeJSON, pick };
