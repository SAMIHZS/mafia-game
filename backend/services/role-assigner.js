'use strict';

/**
 * services/role-assigner.js
 * Assigns roles to players based on player count.
 * Uses Fisher-Yates shuffle for fairness.
 * 
 * Phase 2: Support custom role counts via room settings.
 */

const { ROLES } = require('../config/constants');
const logger = require('../utils/logger');

/**
 * Generate a role list for a given player count.
 * Distribution:
 *   - Mafia:      ~25% of players (min 2)
 *   - Detective:  1 per 6 players
 *   - Doctor:     1 per 8 players (if enabled)
 *   - Villagers:  remainder
 *
 * @param {number} playerCount
 * @param {{ enableDoctor: boolean, enableDetective: boolean }} settings
 * @returns {string[]} Shuffled array of role strings
 */
function generateRoles(playerCount, settings = {}) {
    const { enableDoctor = true, enableDetective = true } = settings;
    const roleList = [];

    // Mafia: 25% of players, minimum 2
    const mafiaCount = Math.max(2, Math.ceil(playerCount * 0.25));
    for (let i = 0; i < mafiaCount; i++) roleList.push(ROLES.MAFIA);

    // Detective: 1 per 6 players
    if (enableDetective) {
        const detectiveCount = Math.ceil(playerCount / 6);
        for (let i = 0; i < detectiveCount; i++) roleList.push(ROLES.DETECTIVE);
    }

    // Doctor: 1 per 8 players
    if (enableDoctor) {
        const doctorCount = Math.ceil(playerCount / 8);
        for (let i = 0; i < doctorCount; i++) roleList.push(ROLES.DOCTOR);
    }

    // Villagers: fill rest
    while (roleList.length < playerCount) {
        roleList.push(ROLES.VILLAGER);
    }

    return fisherYatesShuffle(roleList);
}

/**
 * Assign shuffled roles to players in a room.
 * Mutates player objects in place.
 *
 * @param {import('../models/Player')[]} players - Array of Player instances
 * @param {object} settings - Room settings
 */
function assignRoles(players, settings = {}) {
    if (players.length < 2) {
        throw new Error('Need at least 2 players to assign roles');
    }

    const roles = generateRoles(players.length, settings);

    players.forEach((player, idx) => {
        player.assignRole(roles[idx]);
        logger.debug(`Role assigned: ${player.name} → ${roles[idx]}`);
    });

    logger.info(`Roles assigned for ${players.length} players`);
    return players;
}

/**
 * Fisher-Yates shuffle (in-place, returns shuffled array).
 * @param {any[]} arr
 */
function fisherYatesShuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

module.exports = { generateRoles, assignRoles, fisherYatesShuffle };
