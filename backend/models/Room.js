'use strict';

/**
 * models/Room.js
 * Represents a game room (lobby + active game).
 *
 * Phase 2: Added night action tracking, host transfer, and hasAllNightActions().
 * Phase 3: Persist to MongoDB.
 */

const { GAME_PHASES, ROOM_SETTINGS, ROLES } = require('../config/constants');

class Room {
    /**
     * @param {string} roomId       - 8-char alphanumeric room code
     * @param {string} hostSocketId - Socket ID of the creator
     */
    constructor(roomId, hostSocketId) {
        this.roomId = roomId;
        this.hostId = hostSocketId;
        this.gameState = GAME_PHASES.WAITING_LOBBY;

        /** @type {Map<string, import('./Player')>} socketId → Player */
        this.players = new Map();

        this.settings = {
            nightDuration: parseInt(process.env.NIGHT_DURATION_SECONDS) || 30,
            dayDuration: parseInt(process.env.DAY_DURATION_SECONDS) || 60,
            minPlayers: ROOM_SETTINGS.MIN_PLAYERS,
            maxPlayers: ROOM_SETTINGS.MAX_PLAYERS,
            enableDoctor: true,
            enableDetective: true
        };

        this.gameHistory = {
            dayCount: 0,
            nightKills: [],   // player names killed at night
            eliminated: [],   // player names voted out
            detectiveReveals: {}    // { investigatedSocketId: role } — NEVER sent to clients
        };

        // Night actions — reset each night
        this.nightActions = {
            killTarget: null,   // socketId chosen by Mafia
            saveTarget: null,   // socketId chosen by Doctor
            detectiveTarget: null    // socketId investigated by Detective
        };

        // Phase timer — setTimeout reference, cleared on phase change
        this.phaseTimer = null;
        this.phaseStartTime = null;
        this.phaseEndTime = null;

        // Disconnect grace period timers: socketId → setTimeout ref
        this.gracePeriodTimers = new Map();

        this.createdAt = Date.now();
        this.lastActivity = Date.now();

        const expiryMs = (parseInt(process.env.ROOM_EXPIRY_MINUTES) || 30) * 60 * 1000;
        this.expiresAt = this.createdAt + expiryMs;
    }

    // ─── Player Management ────────────────────────────────────────────────────

    addPlayer(player) {
        if (this.players.size >= this.settings.maxPlayers) {
            throw new Error('Room is full');
        }
        this.players.set(player.socketId, player);
        this.touchActivity();
    }

    removePlayer(socketId) {
        this.players.delete(socketId);
        this.touchActivity();
    }

    getPlayer(socketId) {
        return this.players.get(socketId) || null;
    }

    getPlayers() {
        return Array.from(this.players.values());
    }

    getAlivePlayers() {
        return this.getPlayers().filter(p => p.alive);
    }

    isNameTaken(name) {
        const lower = name.toLowerCase();
        return this.getPlayers().some(p => p.name.toLowerCase() === lower);
    }

    // ─── State ────────────────────────────────────────────────────────────────

    setState(phase) {
        this.gameState = phase;
        this.touchActivity();
    }

    touchActivity() {
        this.lastActivity = Date.now();
        const expiryMs = (parseInt(process.env.ROOM_EXPIRY_MINUTES) || 30) * 60 * 1000;
        this.expiresAt = this.lastActivity + expiryMs;
    }

    isExpired() {
        return Date.now() > this.expiresAt;
    }

    // ─── Phase Timer ─────────────────────────────────────────────────────────

    /**
     * Clear any existing phase timer.
     */
    clearPhaseTimer() {
        if (this.phaseTimer) {
            clearTimeout(this.phaseTimer);
            this.phaseTimer = null;
        }
    }

    /**
     * Set a phase timer that calls callback after durationSeconds.
     * @param {number} durationSeconds
     * @param {Function} callback
     */
    setPhaseTimer(durationSeconds, callback) {
        this.clearPhaseTimer();
        this.phaseStartTime = Date.now();
        this.phaseEndTime = Date.now() + durationSeconds * 1000;
        this.phaseTimer = setTimeout(callback, durationSeconds * 1000);
    }

    /** Seconds remaining in the current phase (for reconnect sync). */
    timeLeft() {
        if (!this.phaseEndTime) return 0;
        return Math.max(0, Math.ceil((this.phaseEndTime - Date.now()) / 1000));
    }

    // ─── Night Actions ────────────────────────────────────────────────────────

    resetNightActions() {
        this.nightActions = { killTarget: null, saveTarget: null, detectiveTarget: null };
    }

    /**
     * Record a night action from a player.
     * @param {'kill'|'save'|'detective'} type
     * @param {string} targetSocketId
     */
    addNightAction(type, targetSocketId) {
        if (type === 'kill') this.nightActions.killTarget = targetSocketId;
        if (type === 'save') this.nightActions.saveTarget = targetSocketId;
        if (type === 'detective') this.nightActions.detectiveTarget = targetSocketId;
    }

    /**
     * Returns true when all alive special-role players have submitted their night action.
     * Allows early resolution of the night phase.
     *
     * Multi-Mafia fix: requires ALL alive Mafia to have set nightActionDone,
     * not just any killTarget being present. The kill target used will be the
     * last one submitted (most recent Mafia to vote wins).
     */
    hasAllNightActions() {
        const alive = this.getAlivePlayers();

        const aliveMafia = alive.filter(p => p.role === ROLES.MAFIA);
        const doctorCount = alive.filter(p => p.role === ROLES.DOCTOR).length;
        const detectiveCount = alive.filter(p => p.role === ROLES.DETECTIVE).length;

        // Every alive Mafia member must have submitted their action
        if (aliveMafia.length > 0 && !aliveMafia.every(p => p.nightActionDone)) return false;

        if (doctorCount > 0 && this.nightActions.saveTarget === null) return false;
        if (detectiveCount > 0 && this.nightActions.detectiveTarget === null) return false;

        return true;
    }

    // ─── Host Transfer ────────────────────────────────────────────────────────

    /**
     * Transfer host to the next connected player.
     * Returns the new host Player, or null if room is empty.
     */
    transferHost() {
        const candidates = this.getPlayers().filter(p => p.socketId !== this.hostId && p.connected);
        if (candidates.length === 0) return null;
        this.hostId = candidates[0].socketId;
        candidates[0].isHost = true;
        return candidates[0];
    }

    // ─── Serializers ─────────────────────────────────────────────────────────

    toPublicJSON() {
        return {
            roomId: this.roomId,
            gameState: this.gameState,
            playerCount: this.players.size,
            maxPlayers: this.settings.maxPlayers,
            hostId: this.hostId,
            players: this.getPlayers().map(p => p.toPublicJSON()),
            settings: {
                nightDuration: this.settings.nightDuration,
                dayDuration: this.settings.dayDuration,
                minPlayers: this.settings.minPlayers,
                enableDoctor: this.settings.enableDoctor,
                enableDetective: this.settings.enableDetective
            },
            timeLeft: this.timeLeft(),
            createdAt: this.createdAt
        };
    }
}

module.exports = Room;
