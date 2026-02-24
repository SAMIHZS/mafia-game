'use strict';

/**
 * models/Player.js
 * Represents a player in a Mafia game room.
 * 
 * Security: The `role` field is NEVER sent to other players.
 * Only server-side logic and private socket emissions use it.
 */

const { ROLES } = require('../config/constants');

class Player {
    /**
     * @param {string} socketId - The Socket.IO socket ID
     * @param {string} name     - Player's display name
     * @param {boolean} isHost  - Whether this player created the room
     */
    constructor(socketId, name, isHost = false) {
        this.socketId = socketId;
        this.name = name.trim();
        this.isHost = isHost;

        // Role (assigned during game start, secret until death or game over)
        this.role = null;

        // Status
        this.alive = true;
        this.connected = true;
        this.joinedAt = Date.now();
        this.lastSeen = Date.now();

        // Voting state (reset each day phase)
        this.hasVoted = false;
        this.votedFor = null;  // socketId of voted player

        // Night action state (reset each night phase)
        this.nightActionDone = false;
        this.nightTarget = null;  // socketId of night target
    }

    // ─── Serializers ────────────────────────────────────────────────────────────

    /**
     * Public view: what ALL players see about this player.
     * NEVER includes role (unless dead).
     */
    toPublicJSON() {
        return {
            socketId: this.socketId,
            name: this.name,
            isHost: this.isHost,
            alive: this.alive,
            connected: this.connected,
            // Role is revealed only after death (optional reveal) — server controls this
            role: this.alive ? null : this.role
        };
    }

    /**
     * Private view: what only THIS player sees (includes their own role).
     */
    toPrivateJSON() {
        return {
            ...this.toPublicJSON(),
            role: this.role,
            hasVoted: this.hasVoted,
            votedFor: this.votedFor
        };
    }

    // ─── State Mutations ─────────────────────────────────────────────────────────

    /** Assign a role to this player. */
    assignRole(role) {
        if (!Object.values(ROLES).includes(role)) {
            throw new Error(`Invalid role: ${role}`);
        }
        this.role = role;
    }

    /** Mark player as eliminated. */
    eliminate() {
        this.alive = false;
    }

    /** Record a vote cast by this player. */
    castVote(targetSocketId) {
        this.hasVoted = true;
        this.votedFor = targetSocketId;
    }

    /** Record a night action. */
    setNightAction(targetSocketId) {
        this.nightActionDone = true;
        this.nightTarget = targetSocketId;
    }

    /** Reset per-day-phase state. */
    resetDayState() {
        this.hasVoted = false;
        this.votedFor = null;
    }

    /** Reset per-night-phase state. */
    resetNightState() {
        this.nightActionDone = false;
        this.nightTarget = null;
    }

    /** Update connection status and last seen timestamp. */
    setConnected(connected) {
        this.connected = connected;
        this.lastSeen = Date.now();
    }
}

module.exports = Player;
