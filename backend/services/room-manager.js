'use strict';

/**
 * services/room-manager.js
 * In-memory CRUD for game rooms.
 *
 * Phase 2: updateSocketMap for rejoin. Phase 3: Replace with MongoDB.
 */

const { v4: uuidv4 } = require('uuid');
const Room = require('../models/Room');
const Player = require('../models/Player');
const logger = require('../utils/logger');
const { ROOM_SETTINGS, ROOM_SETTINGS: RS } = require('../config/constants');

// In-memory store: roomCode → Room
const rooms = new Map();

// Reverse index: socketId → roomCode (for quick lookup on disconnect)
const socketToRoom = new Map();

// ─── Room Code Generation ─────────────────────────────────────────────────────

/**
 * Generates a secure, 8-character alphanumeric room code.
 * Characters chosen to avoid visual confusion (0/O, 1/I/l removed).
 */
function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < ROOM_SETTINGS.ROOM_CODE_LENGTH; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

/** Generate a unique code not already in use. */
function generateUniqueCode() {
    let code;
    let attempts = 0;
    do {
        code = generateRoomCode();
        attempts++;
        if (attempts > 100) throw new Error('Could not generate unique room code');
    } while (rooms.has(code));
    return code;
}

// ─── CRUD Operations ──────────────────────────────────────────────────────────

/** Create a new room. Returns the Room instance. */
function createRoom(hostSocketId = null) {
    const roomId = generateUniqueCode();
    const room = new Room(roomId, hostSocketId);
    rooms.set(roomId, room);
    logger.info(`Room created: ${roomId} (host: ${hostSocketId})`);
    return room;
}

/** Find a room by code. Returns Room or null. */
function findRoom(code) {
    return rooms.get(code.toUpperCase()) || null;
}

/** Delete a room by code. */
function deleteRoom(code) {
    const room = rooms.get(code);
    if (!room) return false;

    // Clean up socket → room index for all players
    for (const player of room.getPlayers()) {
        socketToRoom.delete(player.socketId);
    }
    rooms.delete(code);
    logger.info(`Room deleted: ${code}`);
    return true;
}

/** Find what room a socket is currently in. */
function getRoomBySocket(socketId) {
    const roomCode = socketToRoom.get(socketId);
    if (!roomCode) return null;
    return rooms.get(roomCode) || null;
}

/** Get total active room count. */
function getRoomCount() {
    return rooms.size;
}

// ─── Player Join / Leave ──────────────────────────────────────────────────────

/**
 * Add a player to a room.
 * Returns the new Player instance.
 * Throws on validation failure.
 */
function joinRoom(roomCode, socketId, name) {
    const room = findRoom(roomCode);
    if (!room) throw new Error('Room not found');
    if (room.gameState !== 'WAITING_LOBBY') throw new Error('Game already in progress');
    if (room.players.size >= room.settings.maxPlayers) throw new Error('Room is full');
    if (room.isNameTaken(name)) throw new Error('Name already taken');

    // Validate name: 2-20 chars, alphanumeric + spaces
    if (!name || name.trim().length < 2 || name.trim().length > 20) {
        throw new Error('Name must be 2-20 characters');
    }
    if (!/^[a-zA-Z0-9 ]+$/.test(name.trim())) {
        throw new Error('Name can only contain letters, numbers, and spaces');
    }

    const isHost = room.players.size === 0;  // First to join is host
    if (!room.hostId) room.hostId = socketId;

    const player = new Player(socketId, name.trim(), isHost);
    room.addPlayer(player);
    socketToRoom.set(socketId, roomCode);

    logger.info(`Player joined: ${name} → Room ${roomCode} (host: ${isHost})`);
    return player;
}

/**
 * Remove a player from their room.
 * Returns { room, player } or null if not found.
 */
function leaveRoom(socketId) {
    const room = getRoomBySocket(socketId);
    if (!room) return null;

    const player = room.getPlayer(socketId);
    if (!player) return null;

    room.removePlayer(socketId);
    socketToRoom.delete(socketId);

    logger.info(`Player left: ${player.name} ← Room ${room.roomId}`);
    return { room, player };
}

/**
 * Update the reverse-index when a player rejoins with a new socket ID.
 * Called by rejoin_room handler after migrating the player's socket ID.
 *
 * @param {string} oldSocketId
 * @param {string} newSocketId
 * @param {string} roomCode
 */
function updateSocketMap(oldSocketId, newSocketId, roomCode) {
    socketToRoom.delete(oldSocketId);
    socketToRoom.set(newSocketId, roomCode);
}

// ─── Auto-Cleanup ─────────────────────────────────────────────────────────────

/** Remove expired rooms. Called on an interval. */
function cleanupExpiredRooms() {
    let cleaned = 0;
    for (const [code, room] of rooms.entries()) {
        if (room.isExpired()) {
            deleteRoom(code);
            cleaned++;
        }
    }
    if (cleaned > 0) {
        logger.info(`Cleaned up ${cleaned} expired rooms`);
    }
}

// Run cleanup every 5 minutes
setInterval(cleanupExpiredRooms, 5 * 60 * 1000);

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
    createRoom,
    findRoom,
    deleteRoom,
    getRoomBySocket,
    getRoomCount,
    joinRoom,
    leaveRoom,
    updateSocketMap,
    cleanupExpiredRooms
};
