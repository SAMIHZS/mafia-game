'use strict';

/**
 * services/game-logic.js
 * Full Mafia game engine — Phase 2 implementation.
 *
 * Flow:
 *   startGame → [ROLE_REVEAL delay] → startNightPhase
 *   startNightPhase → [timer or all actions] → resolveNightPhase
 *   resolveNightPhase → checkWin → startDayPhase
 *   startDayPhase → [timer] → resolveDayPhase
 *   resolveDayPhase → checkWin → startNightPhase | endGame
 */

const logger = require('../utils/logger');
const roleAssigner = require('./role-assigner');
const voteCounter = require('./vote-counter');
const GameHistoryDoc = require('../models/GameHistoryDoc');
const { isDbConnected } = require('./db');
const {
    GAME_PHASES,
    ROLES,
    SERVER_EVENTS,
    PHASE_DURATIONS,
    ROLE_DESCRIPTIONS
} = require('../config/constants');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns true if all alive Mafia members have voted the same target (consensus). */
function getMafiaConsensusTarget(room) {
    const aliveMafia = room.getAlivePlayers().filter(p => p.role === ROLES.MAFIA);
    if (aliveMafia.length === 0) return null;

    // Use the most recently-set kill target (last Mafia to vote wins for simplicity in Phase 2)
    return room.nightActions.killTarget;
}

/** Small utility: schedule night-to-night transition after brief delay. */
function scheduleNextNight(room, io, delayMs = 4000) {
    setTimeout(() => {
        if (room.gameState !== GAME_PHASES.GAME_OVER) {
            startNightPhase(room, io);
        }
    }, delayMs);
}

// ─── Game Start ────────────────────────────────────────────────────────────────

/**
 * 1. Validate player count.
 * 2. Assign roles (Fisher-Yates, PRD distribution).
 * 3. Emit game_started to room.
 * 4. Emit your_role_is privately to each player.
 * 5. After ROLE_REVEAL seconds, begin night phase.
 *
 * @param {import('../models/Room')} room
 * @param {import('socket.io').Server} io
 */
function startGame(room, io) {
    const players = room.getPlayers();

    if (players.length < room.settings.minPlayers) {
        throw new Error(`Need at least ${room.settings.minPlayers} players to start`);
    }

    // Assign roles
    roleAssigner.assignRoles(players, room.settings);
    room.setState(GAME_PHASES.ROLE_ASSIGNED);

    io.to(room.roomId).emit(SERVER_EVENTS.GAME_STARTED, {
        phase: GAME_PHASES.ROLE_ASSIGNED,
        playerCount: players.length
    });

    // ⚠️  SECURITY: Each player's role is sent ONLY to them via private socket emission
    players.forEach(player => {
        const roleInfo = ROLE_DESCRIPTIONS[player.role];
        io.to(player.socketId).emit(SERVER_EVENTS.YOUR_ROLE_IS, {
            role: player.role,
            label: roleInfo.label,
            description: roleInfo.description,
            icon: roleInfo.icon,
            team: roleInfo.team
        });
    });

    logger.info(`Game started: ${room.roomId} | ${players.length} players`);

    // After role reveal countdown, start first night
    room.setPhaseTimer(PHASE_DURATIONS.ROLE_REVEAL, () => startNightPhase(room, io));
}

// ─── Night Phase ───────────────────────────────────────────────────────────────

/**
 * Begin the night phase.
 * Resets night actions, sets phase timer, emits night_phase to the room.
 * Alive players with special roles should now emit their night action events.
 *
 * @param {import('../models/Room')} room
 * @param {import('socket.io').Server} io
 */
function startNightPhase(room, io) {
    room.clearPhaseTimer();
    room.setState(GAME_PHASES.NIGHT_PHASE);
    room.resetNightActions();
    room.getPlayers().forEach(p => p.resetNightState());

    const duration = room.settings.nightDuration || PHASE_DURATIONS.NIGHT;

    // Broadcast phase start with timer
    io.to(room.roomId).emit(SERVER_EVENTS.NIGHT_PHASE, {
        timeLeft: duration,
        round: room.gameHistory.dayCount + 1,
        alivePlayers: room.getAlivePlayers().map(p => p.toPublicJSON())
    });

    // Emit role-specific prompts privately to special roles
    room.getAlivePlayers().forEach(player => {
        if (player.role === ROLES.MAFIA) {
            // Tell Mafia who their teammates are
            const mafiaTeam = room.getAlivePlayers()
                .filter(p => p.role === ROLES.MAFIA && p.socketId !== player.socketId)
                .map(p => ({ name: p.name, socketId: p.socketId }));
            io.to(player.socketId).emit(SERVER_EVENTS.MAFIA_TEAM, { teammates: mafiaTeam });
        }
    });

    logger.info(`Night phase: ${room.roomId} | Round ${room.gameHistory.dayCount + 1}`);

    // Auto-resolve when timer expires
    room.setPhaseTimer(duration, () => {
        if (room.gameState === GAME_PHASES.NIGHT_PHASE) {
            resolveNightPhase(room, io);
        }
    });
}

// ─── Night Resolution ──────────────────────────────────────────────────────────

/**
 * Resolve all night actions and transition to day.
 *
 * Logic:
 *   - If killTarget is set AND killTarget ≠ saveTarget → player is eliminated
 *   - If killTarget === saveTarget → doctor saved them (no kill)
 *   - Detective gets a private result for their target
 *   - Check win condition before transitioning
 *
 * @param {import('../models/Room')} room
 * @param {import('socket.io').Server} io
 */
function resolveNightPhase(room, io) {
    room.clearPhaseTimer();

    const { killTarget, saveTarget, detectiveTarget } = room.nightActions;
    let killedPlayer = null;

    // ── Apply kill/save ──────────────────────────────────────────────────────
    if (killTarget) {
        const wasSaved = (killTarget === saveTarget);
        if (!wasSaved) {
            const target = room.getPlayer(killTarget);
            if (target && target.alive) {
                target.eliminate();
                killedPlayer = target;
                room.gameHistory.nightKills.push(target.name);
                logger.info(`Night kill: ${target.name} (${target.role})`);
            }
        } else {
            logger.info(`Doctor saved: ${room.getPlayer(saveTarget)?.name}`);
        }
    }

    // ── Detective result ─────────────────────────────────────────────────────
    if (detectiveTarget) {
        const investigated = room.getPlayer(detectiveTarget);
        if (investigated) {
            room.gameHistory.detectiveReveals[detectiveTarget] = investigated.role;

            // Find the detective player and emit privately
            const detective = room.getAlivePlayers().find(p => p.role === ROLES.DETECTIVE);
            if (detective) {
                io.to(detective.socketId).emit(SERVER_EVENTS.DETECTIVE_RESULT, {
                    targetName: investigated.name,
                    role: investigated.role,
                    isMafia: investigated.role === ROLES.MAFIA
                });
            }
        }
    }

    // ── Win check before day starts ──────────────────────────────────────────
    const winner = voteCounter.checkWinCondition(room);
    if (winner) {
        endGame(room, io, winner);
        return;
    }

    // ── Transition to day ────────────────────────────────────────────────────
    startDayPhase(room, io, killedPlayer);
}

// ─── Day Phase ─────────────────────────────────────────────────────────────────

/**
 * Begin the day phase.
 * Announces night result, resets votes, starts day timer.
 *
 * @param {import('../models/Room')} room
 * @param {import('socket.io').Server} io
 * @param {import('../models/Player')|null} killed - Player killed at night, or null if saved/no kill
 */
function startDayPhase(room, io, killed) {
    room.clearPhaseTimer();
    room.setState(GAME_PHASES.DAY_PHASE);
    room.getPlayers().forEach(p => p.resetDayState());
    room.gameHistory.dayCount++;

    const duration = room.settings.dayDuration || PHASE_DURATIONS.DAY;

    io.to(room.roomId).emit(SERVER_EVENTS.DAY_PHASE, {
        timeLeft: duration,
        round: room.gameHistory.dayCount,
        killedPlayer: killed ? {
            socketId: killed.socketId,
            name: killed.name,
            role: killed.role   // Reveal role on death (as per design)
        } : null,
        players: room.getPlayers().map(p => p.toPublicJSON())
    });

    logger.info(`Day phase: ${room.roomId} | Round ${room.gameHistory.dayCount} | Killed: ${killed?.name ?? 'nobody'}`);

    // Auto-resolve when day timer expires
    room.setPhaseTimer(duration, () => {
        if (room.gameState === GAME_PHASES.DAY_PHASE) {
            resolveDayPhase(room, io);
        }
    });
}

// ─── Day Resolution ────────────────────────────────────────────────────────────

/**
 * Tally votes, eliminate the player with the most votes, then:
 *   - If win condition met → endGame
 *   - Else → start next night after brief delay
 *
 * @param {import('../models/Room')} room
 * @param {import('socket.io').Server} io
 */
function resolveDayPhase(room, io) {
    room.clearPhaseTimer();

    const eliminated = voteCounter.getEliminationTarget(room);

    if (eliminated) {
        eliminated.eliminate();
        room.gameHistory.eliminated.push(eliminated.name);

        io.to(room.roomId).emit(SERVER_EVENTS.PLAYER_ELIMINATED, {
            socketId: eliminated.socketId,
            name: eliminated.name,
            role: eliminated.role
        });

        logger.info(`Day elimination: ${eliminated.name} (${eliminated.role})`);
    } else {
        logger.info(`Day end: no one eliminated (no votes or tie with no players)`);
    }

    // ── Win check ───────────────────────────────────────────────────────────
    const winner = voteCounter.checkWinCondition(room);
    if (winner) {
        endGame(room, io, winner);
        return;
    }

    // ── Next night ──────────────────────────────────────────────────────────
    // Small delay so clients can see the elimination before night begins
    scheduleNextNight(room, io, 4000);
}

// ─── Game Over ─────────────────────────────────────────────────────────────────

/**
 * End the game, reveal all roles, broadcast results.
 *
 * @param {import('../models/Room')} room
 * @param {import('socket.io').Server} io
 * @param {'VILLAGERS_WIN'|'MAFIA_WIN'} winner
 */
function endGame(room, io, winner) {
    room.clearPhaseTimer();
    room.setState(GAME_PHASES.GAME_OVER);

    // Reveal ALL roles at game over
    const finalPlayers = room.getPlayers().map(p => ({
        socketId: p.socketId,
        name: p.name,
        role: p.role,
        alive: p.alive
    }));

    io.to(room.roomId).emit(SERVER_EVENTS.GAME_OVER, {
        winner,
        players: finalPlayers,
        stats: {
            rounds: room.gameHistory.dayCount,
            nightKills: room.gameHistory.nightKills,
            eliminated: room.gameHistory.eliminated
        }
    });

    logger.info(`Game over: ${room.roomId} | Winner: ${winner}`);

    // ── Persist game history to MongoDB ──────────────────────────────────────
    if (isDbConnected()) {
        GameHistoryDoc.create({
            roomCode: room.roomId,
            winner,
            players: room.getPlayers().map(p => ({
                name: p.name,
                role: p.role,
                alive: p.alive,
                isHost: p.isHost
            })),
            stats: {
                rounds: room.gameHistory.dayCount,
                nightKills: room.gameHistory.nightKills,
                eliminated: room.gameHistory.eliminated
            },
            playerCount: room.players.size
        }).catch(err => logger.error('DB save GameHistory error', err.message));
    }

    // Mark room as expiring soon so it gets cleaned up
    setTimeout(() => { room.expiresAt = Date.now() + 5 * 60 * 1000; }, 0);
}


// ─── Early Night Resolution ────────────────────────────────────────────────────

/**
 * Called by socket-events.js when a night action is submitted.
 * If all alive special-role players have acted, resolve the night immediately.
 *
 * @param {import('../models/Room')} room
 * @param {import('socket.io').Server} io
 */
function tryEarlyNightResolution(room, io) {
    if (room.gameState !== GAME_PHASES.NIGHT_PHASE) return;
    if (room.hasAllNightActions()) {
        logger.info(`All night actions submitted — resolving early: ${room.roomId}`);
        resolveNightPhase(room, io);
    }
}

module.exports = {
    startGame,
    startNightPhase,
    resolveNightPhase,
    startDayPhase,
    resolveDayPhase,
    endGame,
    tryEarlyNightResolution
};
