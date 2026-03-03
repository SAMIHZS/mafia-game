'use strict';

/**
 * config/constants.js
 * Central store for all game constants.
 * Phase 2: These will drive phase timers, role ratios, and win conditions.
 */

// ─── Game Phases ──────────────────────────────────────────────────────────────
const GAME_PHASES = {
    WAITING_LOBBY: 'WAITING_LOBBY',
    ROLE_ASSIGNED: 'ROLE_ASSIGNED',
    NIGHT_PHASE: 'NIGHT_PHASE',
    DAY_PHASE: 'DAY_PHASE',
    GAME_OVER: 'GAME_OVER'
};

// ─── Player Roles ─────────────────────────────────────────────────────────────
const ROLES = {
    MAFIA: 'MAFIA',
    DETECTIVE: 'DETECTIVE',
    DOCTOR: 'DOCTOR',
    VILLAGER: 'VILLAGER'
};

// ─── Role Descriptions ────────────────────────────────────────────────────────
const ROLE_DESCRIPTIONS = {
    [ROLES.MAFIA]: {
        label: 'Mafia',
        description: 'Each night, coordinate with other Mafia to silently eliminate a villager. Blend in during the day!',
        icon: '🔫',
        team: 'MAFIA'
    },
    [ROLES.DETECTIVE]: {
        label: 'Detective',
        description: 'Each night, you can investigate one player to learn their true role. Use your knowledge wisely!',
        icon: '🔍',
        team: 'VILLAGERS'
    },
    [ROLES.DOCTOR]: {
        label: 'Doctor',
        description: 'Each night, you can protect one player from being killed. Your saves can turn the tide!',
        icon: '💊',
        team: 'VILLAGERS'
    },
    [ROLES.VILLAGER]: {
        label: 'Villager',
        description: 'Use logic and debate to identify and eliminate the Mafia. Vote carefully!',
        icon: '🏘️',
        team: 'VILLAGERS'
    }
};

// ─── Win Conditions ───────────────────────────────────────────────────────────
const WIN_CONDITIONS = {
    VILLAGERS_WIN: 'VILLAGERS_WIN', // All mafia eliminated
    MAFIA_WIN: 'MAFIA_WIN'      // Mafia count >= villager count
};

// ─── Room Settings ────────────────────────────────────────────────────────────
const ROOM_SETTINGS = {
    MIN_PLAYERS: parseInt(process.env.MIN_PLAYERS) || 6,
    MAX_PLAYERS: parseInt(process.env.MAX_PLAYERS) || 20,
    ROOM_EXPIRY_MINUTES: parseInt(process.env.ROOM_EXPIRY_MINUTES) || 30,
    GRACE_PERIOD_SECONDS: parseInt(process.env.GRACE_PERIOD_SECONDS) || 10,
    ROOM_CODE_LENGTH: 8  // Must be >= 8 for security
};

// ─── Phase Durations (seconds) ────────────────────────────────────────────────
const PHASE_DURATIONS = {
    NIGHT: parseInt(process.env.NIGHT_DURATION_SECONDS) || 30,
    DAY: parseInt(process.env.DAY_DURATION_SECONDS) || 120,
    ROLE_REVEAL: parseInt(process.env.ROLE_REVEAL_DELAY_SECONDS) || 3
};

// ─── Socket Events (Client → Server) ─────────────────────────────────────────
const CLIENT_EVENTS = {
    JOIN_ROOM: 'join_room',
    LEAVE_ROOM: 'leave_room',
    START_GAME: 'start_game',
    DETECTIVE_CHECK: 'detective_check',
    DOCTOR_SAVE: 'doctor_save',
    MAFIA_KILL: 'mafia_kill',
    CAST_VOTE: 'cast_vote',
    PLAYER_MESSAGE: 'player_message',
    REJOIN_ROOM: 'rejoin_room'
};

// ─── Socket Events (Server → Client) ─────────────────────────────────────────
const SERVER_EVENTS = {
    ROOM_CREATED: 'room_created',
    ROOM_JOINED: 'room_joined',
    PLAYER_JOINED: 'player_joined',
    PLAYER_LEFT: 'player_left',
    YOUR_ROLE_IS: 'your_role_is',
    GAME_STARTED: 'game_started',
    NIGHT_PHASE: 'night_phase',
    DAY_PHASE: 'day_phase',
    PLAYER_ELIMINATED: 'player_eliminated',
    VOTE_UPDATED: 'vote_updated',
    GAME_OVER: 'game_over',
    SYNC_FULL_STATE: 'sync_full_state',
    NEW_MESSAGE: 'new_message',
    DETECTIVE_RESULT: 'detective_result',
    ACTION_CONFIRMED: 'action_confirmed',
    HOST_TRANSFERRED: 'host_transferred',
    MAFIA_TEAM: 'mafia_team',
    MAFIA_TARGET_UPDATED: 'mafia_target_updated',
    AUTH_TOKEN: 'auth_token',
    ERROR: 'error'
};

module.exports = {
    GAME_PHASES,
    ROLES,
    ROLE_DESCRIPTIONS,
    WIN_CONDITIONS,
    ROOM_SETTINGS,
    PHASE_DURATIONS,
    CLIENT_EVENTS,
    SERVER_EVENTS
};
