'use strict';

/**
 * services/vote-counter.js
 * Handles vote tallying and elimination logic.
 * 
 * Phase 2: Support vote-change option, abstaining, tie-runs.
 */

const { ROLES } = require('../config/constants');
const logger = require('../utils/logger');

/**
 * Record a vote. Validates that the voter is alive and hasn't voted.
 * Returns updated tally or throws on validation failure.
 *
 * @param {import('../models/Room')} room
 * @param {string} voterSocketId
 * @param {string} targetSocketId
 * @returns {{ tally: object, voterName: string, targetName: string }}
 */
function castVote(room, voterSocketId, targetSocketId) {
    const voter = room.getPlayer(voterSocketId);
    const target = room.getPlayer(targetSocketId);

    if (!voter) throw new Error('Voter not found');
    if (!voter.alive) throw new Error('Dead players cannot vote');
    if (voter.hasVoted) throw new Error('Already voted this round');
    if (!target) throw new Error('Target not found');
    if (!target.alive) throw new Error('Cannot vote for a dead player');
    if (voterSocketId === targetSocketId) throw new Error('Cannot vote for yourself');

    voter.castVote(targetSocketId);
    logger.debug(`Vote: ${voter.name} → ${target.name}`);

    return {
        tally: getVoteTally(room),
        voterName: voter.name,
        targetName: target.name
    };
}

/**
 * Count votes across all alive players.
 * Returns { [targetSocketId]: count }
 *
 * @param {import('../models/Room')} room
 */
function getVoteTally(room) {
    const tally = {};
    for (const player of room.getPlayers()) {
        if (player.hasVoted && player.votedFor) {
            tally[player.votedFor] = (tally[player.votedFor] || 0) + 1;
        }
    }
    return tally;
}

/**
 * Determine which player to eliminate based on vote tally.
 * Tie-breaker: player who received their first vote earliest (stable sort).
 * Returns the Player to eliminate, or null if no votes.
 *
 * @param {import('../models/Room')} room
 */
function getEliminationTarget(room) {
    const tally = getVoteTally(room);
    if (Object.keys(tally).length === 0) return null;

    const sorted = Object.entries(tally).sort(([, a], [, b]) => b - a);
    const topVotes = sorted[0][1];
    const tied = sorted.filter(([, count]) => count === topVotes);

    // Tie: pick first alphabetically by name (deterministic)
    if (tied.length > 1) {
        tied.sort(([idA], [idB]) => {
            const nameA = room.getPlayer(idA)?.name || '';
            const nameB = room.getPlayer(idB)?.name || '';
            return nameA.localeCompare(nameB);
        });
    }

    return room.getPlayer(tied[0][0]) || null;
}

/**
 * Check win conditions after an elimination.
 * Returns 'VILLAGERS_WIN', 'MAFIA_WIN', or null (game continues).
 * Logic:
 *   - All mafia dead → Villagers win
 *   - Mafia count >= non-mafia alive → Mafia win
 *
 * @param {import('../models/Room')} room
 */
function checkWinCondition(room) {
    const alivePlayers = room.getAlivePlayers();
    const aliveMafia = alivePlayers.filter(p => p.role === ROLES.MAFIA);
    const aliveOthers = alivePlayers.filter(p => p.role !== ROLES.MAFIA);

    if (aliveMafia.length === 0) {
        return 'VILLAGERS_WIN';
    }
    if (aliveMafia.length >= aliveOthers.length) {
        return 'MAFIA_WIN';
    }
    return null; // Continue game
}

module.exports = { castVote, getVoteTally, getEliminationTarget, checkWinCondition };
