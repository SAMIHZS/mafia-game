/**
 * frontend/js/room-manager.js
 * Handles Create Room and Join Room flows.
 * Calls the REST API for room creation, Socket.IO for joining.
 */

const RoomManager = (function () {
    // ─── State ────────────────────────────────────────────────────
    let currentRoom = null;  // { roomCode, isHost }
    let currentPlayer = null;  // { name, socketId }

    // ─── REST API ─────────────────────────────────────────────────

    /**
     * Call POST /api/room to create a new room.
     * Returns { roomCode }.
     */
    async function createRoom() {
        const res = await fetch(`${getApiBase()}/api/room`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(err.error || 'Failed to create room');
        }

        const data = await res.json();
        currentRoom = { roomCode: data.roomCode, isHost: true };
        sessionStorage.setItem('mafia_room', data.roomCode);
        return data;
    }

    // ─── Socket.IO ────────────────────────────────────────────────

    /**
     * Emit join_room event and return a promise that resolves on room_joined or rejects on error.
     */
    function joinRoom(roomCode, playerName) {
        return new Promise((resolve, reject) => {
            const socket = window.MafiaSocket;

            // One-time error handler
            const onError = (err) => reject(new Error(err.message || 'Join failed'));
            socket.once('error', onError);

            socket.once('room_joined', (data) => {
                socket.off('error', onError);
                currentRoom = { roomCode: data.roomId, isHost: data.isHost };
                currentPlayer = { name: playerName, socketId: data.playerId };
                sessionStorage.setItem('mafia_room', data.roomId);
                sessionStorage.setItem('mafia_player', playerName);
                resolve(data);
            });

            socket.emit('join_room', {
                code: roomCode.toUpperCase().trim(),
                name: playerName.trim()
            });
        });
    }

    /** Leave current room. */
    function leaveRoom() {
        const socket = window.MafiaSocket;
        socket.emit('leave_room', {});
        currentRoom = null;
        currentPlayer = null;
        sessionStorage.removeItem('mafia_room');
        sessionStorage.removeItem('mafia_player');
    }

    // ─── Helpers ─────────────────────────────────────────────────

    function getApiBase() {
        return window.__MAFIA_CONFIG__?.backendUrl
            || localStorage.getItem('mafia_backend_url')
            || (window.location.hostname === 'localhost'
                ? 'http://localhost:3001'
                : window.location.origin);
    }

    function getCurrentRoom() { return currentRoom; }
    function getCurrentPlayer() { return currentPlayer; }

    return { createRoom, joinRoom, leaveRoom, getCurrentRoom, getCurrentPlayer };
})();

window.RoomManager = RoomManager;
