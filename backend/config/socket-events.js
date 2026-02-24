'use strict';

/**
 * config/socket-events.js
 * Full Phase 2 Socket.IO event handlers.
 *
 * Handles: join_room, leave_room, start_game, mafia_kill, detective_check,
 *          doctor_save, cast_vote, player_message, rejoin_room, disconnect.
 * Includes: host transfer, disconnect grace period.
 */

const logger = require('../utils/logger');
const gameLogic = require('../services/game-logic');
const voteCounter = require('../services/vote-counter');
const auth = require('../middleware/auth');
const {
    CLIENT_EVENTS,
    SERVER_EVENTS,
    GAME_PHASES,
    ROLES,
    ROOM_SETTINGS
} = require('./constants');

// ─── Rate Limiting ────────────────────────────────────────────────────────────
const joinAttempts = new Map();
const JOIN_RATE_LIMIT = 10;

function checkRateLimit(ip) {
    const now = Date.now();
    const window = 60 * 1000;
    const entry = joinAttempts.get(ip) || { count: 0, resetAt: now + window };

    if (now > entry.resetAt) {
        entry.count = 0;
        entry.resetAt = now + window;
    }
    entry.count++;
    joinAttempts.set(ip, entry);
    return entry.count <= JOIN_RATE_LIMIT;
}

// ─── Main Registration ────────────────────────────────────────────────────────

/**
 * @param {import('socket.io').Server} io
 * @param {import('../services/room-manager')} roomManager
 */
function registerSocketEvents(io, roomManager) {

    io.on('connection', (socket) => {
        logger.info(`Socket connected: ${socket.id} (${socket.handshake.address})`);

        // ══════════════════════════════════════════════════════════
        // JOIN ROOM
        // ══════════════════════════════════════════════════════════
        socket.on(CLIENT_EVENTS.JOIN_ROOM, (data) => {
            try {
                const { code, name } = data || {};

                if (!checkRateLimit(socket.handshake.address)) {
                    return socket.emit(SERVER_EVENTS.ERROR, { message: 'Too many join attempts. Wait 1 minute.' });
                }

                if (!code || typeof code !== 'string') {
                    return socket.emit(SERVER_EVENTS.ERROR, { message: 'Room code is required' });
                }
                if (!name || typeof name !== 'string' || name.trim().length < 2) {
                    return socket.emit(SERVER_EVENTS.ERROR, { message: 'Player name is required (2+ chars)' });
                }

                const player = roomManager.joinRoom(code.toUpperCase().trim(), socket.id, name.trim());
                const room = roomManager.findRoom(code.toUpperCase().trim());

                socket.join(room.roomId);

                socket.emit(SERVER_EVENTS.ROOM_JOINED, {
                    roomId: room.roomId,
                    playerId: socket.id,
                    isHost: player.isHost,
                    players: room.getPlayers().map(p => p.toPublicJSON()),
                    settings: room.settings
                });

                // Issue JWT for secure rejoin
                const token = auth.issueToken(room.roomId, player.name, socket.id);
                socket.emit(SERVER_EVENTS.AUTH_TOKEN, { token });

                socket.to(room.roomId).emit(SERVER_EVENTS.PLAYER_JOINED, {
                    name: player.name,
                    isHost: player.isHost,
                    count: room.players.size,
                    players: room.getPlayers().map(p => p.toPublicJSON())
                });

                logger.info(`"${name}" joined room ${room.roomId} (${room.players.size} players)`);

            } catch (err) {
                logger.error('join_room error', err);
                socket.emit(SERVER_EVENTS.ERROR, { message: err.message });
            }
        });

        // ══════════════════════════════════════════════════════════
        // START GAME
        // ══════════════════════════════════════════════════════════
        socket.on(CLIENT_EVENTS.START_GAME, () => {
            try {
                const room = roomManager.getRoomBySocket(socket.id);
                if (!room) return socket.emit(SERVER_EVENTS.ERROR, { message: 'Not in a room' });
                if (room.hostId !== socket.id) return socket.emit(SERVER_EVENTS.ERROR, { message: 'Only the host can start the game' });
                if (room.gameState !== GAME_PHASES.WAITING_LOBBY) return socket.emit(SERVER_EVENTS.ERROR, { message: 'Game already started' });

                gameLogic.startGame(room, io);
            } catch (err) {
                logger.error('start_game error', err);
                socket.emit(SERVER_EVENTS.ERROR, { message: err.message });
            }
        });

        // ══════════════════════════════════════════════════════════
        // MAFIA KILL
        // ══════════════════════════════════════════════════════════
        socket.on(CLIENT_EVENTS.MAFIA_KILL, (data) => {
            try {
                const room = roomManager.getRoomBySocket(socket.id);
                if (!room) return socket.emit(SERVER_EVENTS.ERROR, { message: 'Not in a room' });

                const player = room.getPlayer(socket.id);
                if (!player || !player.alive) return socket.emit(SERVER_EVENTS.ERROR, { message: 'You are not alive' });
                if (player.role !== ROLES.MAFIA) return socket.emit(SERVER_EVENTS.ERROR, { message: 'Only Mafia can kill' });
                if (room.gameState !== GAME_PHASES.NIGHT_PHASE) return socket.emit(SERVER_EVENTS.ERROR, { message: 'Not the night phase' });
                if (player.nightActionDone) return socket.emit(SERVER_EVENTS.ERROR, { message: 'You already submitted your kill' });

                const { targetId } = data || {};
                if (!targetId) return socket.emit(SERVER_EVENTS.ERROR, { message: 'Target is required' });
                if (targetId === socket.id) return socket.emit(SERVER_EVENTS.ERROR, { message: 'Cannot target yourself' });

                const target = room.getPlayer(targetId);
                if (!target || !target.alive) return socket.emit(SERVER_EVENTS.ERROR, { message: 'Invalid target' });
                if (target.role === ROLES.MAFIA) return socket.emit(SERVER_EVENTS.ERROR, { message: 'Cannot kill a Mafia member' });

                // Record action
                room.addNightAction('kill', targetId);
                player.setNightAction(targetId);

                socket.emit(SERVER_EVENTS.ACTION_CONFIRMED, { message: `🎯 Kill submitted for ${target.name}. Waiting for dawn...` });

                // Notify other Mafia members of the chosen target
                room.getAlivePlayers()
                    .filter(p => p.role === ROLES.MAFIA && p.socketId !== socket.id)
                    .forEach(mafioso => {
                        io.to(mafioso.socketId).emit(SERVER_EVENTS.MAFIA_TARGET_UPDATED, {
                            targetName: target.name,
                            chosenBy: player.name
                        });
                    });

                // Try to resolve early if all special roles have acted
                gameLogic.tryEarlyNightResolution(room, io);

            } catch (err) {
                logger.error('mafia_kill error', err);
                socket.emit(SERVER_EVENTS.ERROR, { message: err.message });
            }
        });

        // ══════════════════════════════════════════════════════════
        // DETECTIVE CHECK
        // ══════════════════════════════════════════════════════════
        socket.on(CLIENT_EVENTS.DETECTIVE_CHECK, (data) => {
            try {
                const room = roomManager.getRoomBySocket(socket.id);
                if (!room) return socket.emit(SERVER_EVENTS.ERROR, { message: 'Not in a room' });

                const player = room.getPlayer(socket.id);
                if (!player || !player.alive) return socket.emit(SERVER_EVENTS.ERROR, { message: 'You are not alive' });
                if (player.role !== ROLES.DETECTIVE) return socket.emit(SERVER_EVENTS.ERROR, { message: 'Only the Detective can investigate' });
                if (room.gameState !== GAME_PHASES.NIGHT_PHASE) return socket.emit(SERVER_EVENTS.ERROR, { message: 'Not the night phase' });
                if (player.nightActionDone) return socket.emit(SERVER_EVENTS.ERROR, { message: 'You already investigated tonight' });

                const { targetId } = data || {};
                if (!targetId) return socket.emit(SERVER_EVENTS.ERROR, { message: 'Target is required' });
                if (targetId === socket.id) return socket.emit(SERVER_EVENTS.ERROR, { message: 'Cannot investigate yourself' });

                const target = room.getPlayer(targetId);
                if (!target || !target.alive) return socket.emit(SERVER_EVENTS.ERROR, { message: 'Invalid target' });

                room.addNightAction('detective', targetId);
                player.setNightAction(targetId);

                socket.emit(SERVER_EVENTS.ACTION_CONFIRMED, { message: `🔍 Investigation submitted. Results at dawn...` });

                gameLogic.tryEarlyNightResolution(room, io);

            } catch (err) {
                logger.error('detective_check error', err);
                socket.emit(SERVER_EVENTS.ERROR, { message: err.message });
            }
        });

        // ══════════════════════════════════════════════════════════
        // DOCTOR SAVE
        // ══════════════════════════════════════════════════════════
        socket.on(CLIENT_EVENTS.DOCTOR_SAVE, (data) => {
            try {
                const room = roomManager.getRoomBySocket(socket.id);
                if (!room) return socket.emit(SERVER_EVENTS.ERROR, { message: 'Not in a room' });

                const player = room.getPlayer(socket.id);
                if (!player || !player.alive) return socket.emit(SERVER_EVENTS.ERROR, { message: 'You are not alive' });
                if (player.role !== ROLES.DOCTOR) return socket.emit(SERVER_EVENTS.ERROR, { message: 'Only the Doctor can protect' });
                if (room.gameState !== GAME_PHASES.NIGHT_PHASE) return socket.emit(SERVER_EVENTS.ERROR, { message: 'Not the night phase' });
                if (player.nightActionDone) return socket.emit(SERVER_EVENTS.ERROR, { message: 'You already protected someone tonight' });

                const { targetId } = data || {};
                if (!targetId) return socket.emit(SERVER_EVENTS.ERROR, { message: 'Target is required' });

                const target = room.getPlayer(targetId);
                if (!target || !target.alive) return socket.emit(SERVER_EVENTS.ERROR, { message: 'Invalid target' });

                room.addNightAction('save', targetId);
                player.setNightAction(targetId);

                socket.emit(SERVER_EVENTS.ACTION_CONFIRMED, { message: `💊 Protection granted to ${target.name}. Sleep tight...` });

                gameLogic.tryEarlyNightResolution(room, io);

            } catch (err) {
                logger.error('doctor_save error', err);
                socket.emit(SERVER_EVENTS.ERROR, { message: err.message });
            }
        });

        // ══════════════════════════════════════════════════════════
        // CAST VOTE (day phase)
        // ══════════════════════════════════════════════════════════
        socket.on(CLIENT_EVENTS.CAST_VOTE, (data) => {
            try {
                const room = roomManager.getRoomBySocket(socket.id);
                if (!room) return socket.emit(SERVER_EVENTS.ERROR, { message: 'Not in a room' });
                if (room.gameState !== GAME_PHASES.DAY_PHASE) return socket.emit(SERVER_EVENTS.ERROR, { message: 'Not in voting phase' });

                const { targetId } = data || {};
                if (!targetId) return socket.emit(SERVER_EVENTS.ERROR, { message: 'Target is required' });

                const result = voteCounter.castVote(room, socket.id, targetId);

                // Broadcast anonymous tally only — never reveal who voted for whom
                io.to(room.roomId).emit(SERVER_EVENTS.VOTE_UPDATED, {
                    tally: result.tally
                });

                // Early day resolution if all alive players have voted.
                // 500ms delay lets clients render the final tally before phase changes.
                const alivePlayers = room.getAlivePlayers();
                const allVoted = alivePlayers.every(p => p.hasVoted);
                if (allVoted) {
                    logger.info(`All players voted — resolving day early: ${room.roomId}`);
                    setTimeout(() => {
                        if (room.gameState === GAME_PHASES.DAY_PHASE) {
                            gameLogic.resolveDayPhase(room, io);
                        }
                    }, 500);
                }

            } catch (err) {
                logger.error('cast_vote error', err);
                socket.emit(SERVER_EVENTS.ERROR, { message: err.message });
            }
        });

        // ══════════════════════════════════════════════════════════
        // PLAYER MESSAGE (chat — day phase only)
        // ══════════════════════════════════════════════════════════
        socket.on(CLIENT_EVENTS.PLAYER_MESSAGE, (data) => {
            try {
                const room = roomManager.getRoomBySocket(socket.id);
                if (!room) return socket.emit(SERVER_EVENTS.ERROR, { message: 'Not in a room' });

                const player = room.getPlayer(socket.id);
                if (!player) return socket.emit(SERVER_EVENTS.ERROR, { message: 'Player not found' });

                // Only alive players can chat during day phase
                // Dead players message is blocked (Phase 3: add dead-chat channel)
                if (!player.alive) return socket.emit(SERVER_EVENTS.ERROR, { message: 'Dead players cannot speak' });
                // Chat is only available during the day phase (not lobby, not night, not game over)
                if (room.gameState !== GAME_PHASES.DAY_PHASE) {
                    return socket.emit(SERVER_EVENTS.ERROR, { message: 'Chat is only available during the day phase' });
                }

                const { text } = data || {};
                if (!text || typeof text !== 'string') return socket.emit(SERVER_EVENTS.ERROR, { message: 'Message is required' });

                const sanitized = text.trim().slice(0, 200); // max 200 chars
                if (sanitized.length === 0) return;

                io.to(room.roomId).emit(SERVER_EVENTS.NEW_MESSAGE, {
                    from: player.name,
                    text: sanitized,
                    timestamp: Date.now()
                });

            } catch (err) {
                logger.error('player_message error', err);
                socket.emit(SERVER_EVENTS.ERROR, { message: err.message });
            }
        });

        // ══════════════════════════════════════════════════════════
        // LEAVE ROOM (explicit)
        // ══════════════════════════════════════════════════════════
        socket.on(CLIENT_EVENTS.LEAVE_ROOM, () => {
            // Cancel grace period timer if they explicitly leave
            const room = roomManager.getRoomBySocket(socket.id);
            if (room) room.gracePeriodTimers.delete(socket.id);
            handleLeave(socket, io, roomManager, true);
        });

        // ══════════════════════════════════════════════════════════
        // REJOIN ROOM (JWT-secured)
        // ══════════════════════════════════════════════════════════
        socket.on(CLIENT_EVENTS.REJOIN_ROOM, (data) => {
            try {
                const { token } = data || {};

                // ── Try JWT first ─────────────────────────────────────────
                let roomCode, playerName;
                if (token) {
                    try {
                        const decoded = auth.verifyToken(token);
                        roomCode = decoded.roomCode;
                        playerName = decoded.playerName;
                    } catch {
                        return socket.emit(SERVER_EVENTS.ERROR, { message: 'Session expired. Please rejoin manually.' });
                    }
                } else {
                    // Fallback: legacy name-based rejoin
                    roomCode = data?.roomCode?.toUpperCase();
                    playerName = data?.playerName;
                }

                if (!roomCode || !playerName) {
                    return socket.emit(SERVER_EVENTS.ERROR, { message: 'Room code and player name are required' });
                }

                const room = roomManager.findRoom(roomCode);
                if (!room) return socket.emit(SERVER_EVENTS.ERROR, { message: 'Room not found' });
                if (room.gameState === GAME_PHASES.GAME_OVER) return socket.emit(SERVER_EVENTS.ERROR, { message: 'Game is over' });

                // Find the disconnected player by name
                const player = room.getPlayers().find(
                    p => p.name.toLowerCase() === playerName.trim().toLowerCase() && !p.connected
                );
                if (!player) return socket.emit(SERVER_EVENTS.ERROR, { message: 'Player not found or already connected' });

                // Cancel grace period timer
                const graceTimer = room.gracePeriodTimers.get(player.socketId);
                if (graceTimer) {
                    clearTimeout(graceTimer);
                    room.gracePeriodTimers.delete(player.socketId);
                }

                // Migrate socket ID
                const oldSocketId = player.socketId;
                room.players.delete(oldSocketId);
                player.socketId = socket.id;
                player.connected = true;
                player.lastSeen = Date.now();
                room.players.set(socket.id, player);
                roomManager.updateSocketMap(oldSocketId, socket.id, room.roomId);

                socket.join(room.roomId);

                // Issue fresh JWT
                const newToken = auth.issueToken(room.roomId, player.name, socket.id);
                socket.emit(SERVER_EVENTS.AUTH_TOKEN, { token: newToken });

                // Full state sync
                const ROLE_DESCRIPTIONS = require('./constants').ROLE_DESCRIPTIONS;
                socket.emit(SERVER_EVENTS.SYNC_FULL_STATE, {
                    roomId: room.roomId,
                    playerId: socket.id,
                    isHost: player.isHost,
                    gameState: room.gameState,
                    players: room.getPlayers().map(p => p.toPublicJSON()),
                    timeLeft: room.timeLeft(),
                    myRole: player.role ? {
                        role: player.role,
                        label: ROLE_DESCRIPTIONS[player.role]?.label,
                        description: ROLE_DESCRIPTIONS[player.role]?.description,
                        icon: ROLE_DESCRIPTIONS[player.role]?.icon,
                        team: ROLE_DESCRIPTIONS[player.role]?.team
                    } : null
                });

                socket.to(room.roomId).emit(SERVER_EVENTS.PLAYER_JOINED, {
                    name: player.name,
                    reconnect: true,
                    players: room.getPlayers().map(p => p.toPublicJSON())
                });

                logger.info(`"${player.name}" rejoined room ${room.roomId}`);

            } catch (err) {
                logger.error('rejoin_room error', err);
                socket.emit(SERVER_EVENTS.ERROR, { message: err.message });
            }
        });

        // ══════════════════════════════════════════════════════════
        // DISCONNECT
        // ══════════════════════════════════════════════════════════
        socket.on('disconnect', (reason) => {
            logger.info(`Socket disconnected: ${socket.id} (${reason})`);

            const room = roomManager.getRoomBySocket(socket.id);
            if (!room) return;

            const player = room.getPlayer(socket.id);
            if (!player) return;

            // Mark as disconnected immediately
            player.setConnected(false);

            // Notify room of disconnection
            socket.to(room.roomId).emit(SERVER_EVENTS.PLAYER_LEFT, {
                name: player.name,
                disconnected: true,
                players: room.getPlayers().map(p => p.toPublicJSON())
            });

            // Grace period: give the player time to reconnect before removing them
            const graceSeconds = parseInt(process.env.GRACE_PERIOD_SECONDS) || ROOM_SETTINGS.GRACE_PERIOD_SECONDS || 10;

            const timer = setTimeout(() => {
                room.gracePeriodTimers.delete(socket.id);
                // If still disconnected after grace period, fully remove
                if (!room.getPlayer(socket.id)?.connected) {
                    handleLeave(socket, io, roomManager, false);
                }
            }, graceSeconds * 1000);

            room.gracePeriodTimers.set(socket.id, timer);
        });
    });
}

// ─── Leave Handler ─────────────────────────────────────────────────────────────

/**
 * Remove a player from their room. Handle host transfer and empty rooms.
 * @param {boolean} explicit - true if player explicitly left (not just disconnected)
 */
function handleLeave(socket, io, roomManager, explicit = true) {
    const result = roomManager.leaveRoom(socket.id);
    if (!result) return;

    const { room, player } = result;

    // ── Host transfer ────────────────────────────────────────────────────────
    if (player.isHost && room.players.size > 0) {
        const newHost = room.transferHost();
        if (newHost) {
            io.to(room.roomId).emit(SERVER_EVENTS.HOST_TRANSFERRED, {
                newHostId: newHost.socketId,
                newHostName: newHost.name,
                players: room.getPlayers().map(p => p.toPublicJSON())
            });
            logger.info(`Host transferred to "${newHost.name}" in room ${room.roomId}`);
        }
    }

    // ── Notify remaining players ─────────────────────────────────────────────
    io.to(room.roomId).emit(SERVER_EVENTS.PLAYER_LEFT, {
        name: player.name,
        explicit: explicit,
        players: room.getPlayers().map(p => p.toPublicJSON())
    });

    // ── Delete empty room ────────────────────────────────────────────────────
    if (room.players.size === 0) {
        room.clearPhaseTimer();
        roomManager.deleteRoom(room.roomId);
        logger.info(`Room ${room.roomId} deleted (empty)`);
    }
}

module.exports = { registerSocketEvents };
