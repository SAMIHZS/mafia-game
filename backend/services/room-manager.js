'use strict';

/**
 * services/room-manager.js
 * Phase 3: MongoDB-backed room persistence.
 * In-memory Map still drives active game logic.
 * MongoDB = durable store (survives server restarts for lobby rooms).
 */

const Room = require('../models/Room');
const Player = require('../models/Player');
const RoomDoc = require('../models/RoomDoc');
const logger = require('../utils/logger');
const { isDbConnected } = require('./db');
const { ROOM_SETTINGS } = require('../config/constants');

// In-memory store: roomCode → Room (game engine source of truth)
const rooms = new Map();

// Reverse index: socketId → roomCode
const socketToRoom = new Map();

// ─── Room Code Generation ─────────────────────────────────────────────────────

function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < ROOM_SETTINGS.ROOM_CODE_LENGTH; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

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

// ─── CRUD ────────────────────────────────────────────────────────────────────

/**
 * Create a new room in memory + MongoDB.
 * @param {string|null} hostSocketId
 * @returns {Room}
 */
async function createRoom(hostSocketId = null) {
    const roomId = generateUniqueCode();
    const room = new Room(roomId, hostSocketId);
    rooms.set(roomId, room);
    logger.info(`Room created: ${roomId}`);

    // Persist to MongoDB (fire-and-forget — game works without it)
    if (isDbConnected()) {
        RoomDoc.create({
            roomCode: roomId,
            hostName: 'unknown', // updated when first player joins
            playerNames: [],
            gameState: 'WAITING_LOBBY',
            settings: room.settings,
            expiresAt: new Date(room.expiresAt)
        }).catch(err => logger.error('DB createRoom error', err.message));
    }

    return room;
}

/** Find a room by code. */
function findRoom(code) {
    return rooms.get(code.toUpperCase()) || null;
}

/** Delete a room from memory + MongoDB. */
function deleteRoom(code) {
    const room = rooms.get(code);
    if (!room) return false;

    // Clear phase timer to prevent leaked timers
    room.clearPhaseTimer();

    for (const player of room.getPlayers()) {
        socketToRoom.delete(player.socketId);
    }
    rooms.delete(code);
    logger.info(`Room deleted: ${code}`);

    if (isDbConnected()) {
        RoomDoc.deleteOne({ roomCode: code })
            .catch(err => logger.error('DB deleteRoom error', err.message));
    }

    return true;
}

/** Get room by socket ID. */
function getRoomBySocket(socketId) {
    const roomCode = socketToRoom.get(socketId);
    return roomCode ? (rooms.get(roomCode) || null) : null;
}

/** Get total rooms in memory. */
function getRoomCount() { return rooms.size; }

// ─── Player Join / Leave ──────────────────────────────────────────────────────

/**
 * Add a player to a room.
 * @returns {Player}
 */
function joinRoom(roomCode, socketId, name) {
    const room = findRoom(roomCode);
    if (!room) throw new Error('Room not found');
    if (room.gameState !== 'WAITING_LOBBY') throw new Error('Game already in progress');
    if (room.players.size >= room.settings.maxPlayers) throw new Error('Room is full');
    if (room.isNameTaken(name)) throw new Error('Name already taken in this room');

    const trimmedName = name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 20) {
        throw new Error('Name must be 2-20 characters');
    }
    if (!/^[a-zA-Z0-9 ]+$/.test(trimmedName)) {
        throw new Error('Name can only contain letters, numbers, and spaces');
    }

    const isHost = room.players.size === 0;
    if (!room.hostId) room.hostId = socketId;

    const player = new Player(socketId, trimmedName, isHost);
    room.addPlayer(player);
    socketToRoom.set(socketId, roomCode);

    logger.info(`"${trimmedName}" joined ${roomCode} (host: ${isHost})`);

    // Update MongoDB player list
    if (isDbConnected()) {
        const playerNames = room.getPlayers().map(p => p.name);
        RoomDoc.updateOne(
            { roomCode },
            { $set: { playerNames, hostName: room.getPlayer(room.hostId)?.name || 'unknown' } }
        ).catch(err => logger.error('DB joinRoom update error', err.message));
    }

    return player;
}

/**
 * Remove a player from their room.
 * @returns {{ room, player } | null}
 */
function leaveRoom(socketId) {
    const room = getRoomBySocket(socketId);
    if (!room) return null;

    const player = room.getPlayer(socketId);
    if (!player) return null;

    room.removePlayer(socketId);
    socketToRoom.delete(socketId);

    logger.info(`"${player.name}" left ${room.roomId}`);

    // Update MongoDB
    if (isDbConnected()) {
        const playerNames = room.getPlayers().map(p => p.name);
        RoomDoc.updateOne(
            { roomCode: room.roomId },
            { $set: { playerNames } }
        ).catch(err => logger.error('DB leaveRoom update error', err.message));
    }

    return { room, player };
}

/**
 * Update the socket→room index when a player rejoins with a new socket ID.
 */
function updateSocketMap(oldSocketId, newSocketId, roomCode) {
    socketToRoom.delete(oldSocketId);
    socketToRoom.set(newSocketId, roomCode);
}

// ─── Startup Restore ─────────────────────────────────────────────────────────

/**
 * On server startup, reload WAITING_LOBBY rooms from MongoDB into memory.
 * Mid-game rooms are too complex to restore without full game state — skipped.
 */
async function restoreRoomsFromDB() {
    if (!isDbConnected()) return;

    try {
        const docs = await RoomDoc.find({ gameState: 'WAITING_LOBBY' }).lean();
        let restored = 0;

        for (const doc of docs) {
            if (rooms.has(doc.roomCode)) continue; // already in memory
            if (new Date() > new Date(doc.expiresAt)) continue; // expired

            const room = new Room(doc.roomCode, null);
            Object.assign(room.settings, doc.settings);
            room.expiresAt = new Date(doc.expiresAt).getTime();
            rooms.set(doc.roomCode, room);
            restored++;
        }

        if (restored > 0) logger.info(`Restored ${restored} rooms from MongoDB`);
    } catch (err) {
        logger.error('Failed to restore rooms from DB', err.message);
    }
}

// ─── Auto-Cleanup ─────────────────────────────────────────────────────────────

function cleanupExpiredRooms() {
    let cleaned = 0;
    for (const [code, room] of rooms.entries()) {
        if (room.isExpired()) {
            deleteRoom(code);
            cleaned++;
        }
    }
    if (cleaned > 0) logger.info(`Cleaned up ${cleaned} expired rooms`);
}

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
    restoreRoomsFromDB,
    cleanupExpiredRooms
};
