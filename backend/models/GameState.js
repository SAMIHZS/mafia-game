'use strict';

/**
 * models/GameState.js
 * Tracks the current authoritative game state for a room.
 * The server is the SINGLE SOURCE OF TRUTH.
 *
 * Phase 2: Add full state machine validation with allowed transitions.
 */

const { GAME_PHASES } = require('../config/constants');

class GameState {
    constructor(roomId) {
        this.roomId = roomId;
        this.phase = GAME_PHASES.WAITING_LOBBY;
        this.round = 0;      // Increments each full night+day cycle
        this.phaseStartTime = null;
        this.phaseEndTime = null;

        // Night phase tracking
        this.nightKillTarget = null;   // socketId chosen by mafia
        this.nightSaveTarget = null;   // socketId chosen by doctor
        this.nightCheckTarget = null;   // socketId chosen by detective

        // Day phase tracking
        this.votes = new Map();  // targetSocketId → Set<voterSocketId>
        this.eliminatedPlayer = null;

        // Game result
        this.winner = null;   // 'VILLAGERS_WIN' | 'MAFIA_WIN' | null
        this.gameStartTime = null;
        this.gameEndTime = null;
    }

    /** Validates and performs a phase transition. */
    transition(newPhase) {
        const allowed = this._allowedTransitions();
        if (!allowed.includes(newPhase)) {
            throw new Error(`Invalid transition: ${this.phase} → ${newPhase}`);
        }
        this.phase = newPhase;
        this.phaseStartTime = Date.now();

        // TODO (Phase 2): set phaseEndTime based on phase duration, start countdown timer
    }

    _allowedTransitions() {
        const T = GAME_PHASES;
        const map = {
            [T.WAITING_LOBBY]: [T.ROLE_ASSIGNED],
            [T.ROLE_ASSIGNED]: [T.NIGHT_PHASE],
            [T.NIGHT_PHASE]: [T.DAY_PHASE],
            [T.DAY_PHASE]: [T.NIGHT_PHASE, T.GAME_OVER],
            [T.GAME_OVER]: []
        };
        return map[this.phase] || [];
    }

    /** Record a vote. Returns the updated vote counts. */
    recordVote(voterSocketId, targetSocketId) {
        if (!this.votes.has(targetSocketId)) {
            this.votes.set(targetSocketId, new Set());
        }
        this.votes.get(targetSocketId).add(voterSocketId);
        return this.getVoteTally();
    }

    /** Returns { [targetSocketId]: count } */
    getVoteTally() {
        const tally = {};
        for (const [target, voters] of this.votes.entries()) {
            tally[target] = voters.size;
        }
        return tally;
    }

    /** Determine elimination winner. Returns socketId or null (tie = first alphabetically). */
    getEliminationTarget() {
        const tally = this.getVoteTally();
        if (Object.keys(tally).length === 0) return null;
        return Object.entries(tally)
            .sort(([, a], [, b]) => b - a || 0)
        [0][0];
    }

    /** Reset vote state for new day phase. */
    resetVotes() {
        this.votes = new Map();
        this.eliminatedPlayer = null;
    }

    /** Reset night action state. */
    resetNightActions() {
        this.nightKillTarget = null;
        this.nightSaveTarget = null;
        this.nightCheckTarget = null;
    }

    toJSON() {
        return {
            roomId: this.roomId,
            phase: this.phase,
            round: this.round,
            phaseStartTime: this.phaseStartTime,
            winner: this.winner
        };
    }
}

module.exports = GameState;
