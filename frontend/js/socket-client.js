/**
 * frontend/js/socket-client.js
 * Socket.IO client with reconnect handling and JWT-based auto-rejoin.
 *
 * Phase 3: Stores JWT token → auto-rejoin on reconnect.
 * Backend URL configured via window.__MAFIA_CONFIG__.backendUrl
 * (set in index.html meta tag — override for production Railway URL).
 */


(function () {
    // Determine backend URL: check localStorage override (for dev) or use window.location
    const BACKEND_URL = window.__MAFIA_CONFIG__?.backendUrl
        || localStorage.getItem('mafia_backend_url')
        || (window.location.hostname === 'localhost'
            ? 'http://localhost:3001'
            : window.location.origin);

    // ─── Socket.IO Connection ────────────────────────────────────
    const socket = io(BACKEND_URL, {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 10,
        transports: ['websocket', 'polling']
        // Phase 2: Add auth:
        // auth: { token: localStorage.getItem('mafia_token') }
    });

    // ─── Connection Status UI ────────────────────────────────────
    const statusEl = document.getElementById('connection-status');

    function updateConnectionStatus(state) {
        if (!statusEl) return;
        statusEl.className = `connection-status ${state}`;

        const labels = {
            connected: '🟢 Connected',
            disconnected: '🔴 Disconnected',
            reconnecting: '🟡 Reconnecting...'
        };
        statusEl.innerHTML = `<span class="status-dot"></span>${labels[state] || state}`;
    }

    socket.on('connect', () => {
        console.log('[Socket] Connected:', socket.id);
        updateConnectionStatus('connected');
        Utils.showToast('Connected to server', 'success', 2000);

        // If we have a stored JWT token, attempt secure auto-rejoin
        const storedToken = sessionStorage.getItem('mafia_token');
        const savedRoom = sessionStorage.getItem('mafia_room');
        if (storedToken && savedRoom) {
            console.log('[Socket] Attempting JWT rejoin for room:', savedRoom);
            socket.emit('rejoin_room', { token: storedToken });
        }
    });

    // ─── Auth Token (Phase 3) — store JWT on join/rejoin ─────────
    socket.on('auth_token', ({ token }) => {
        if (token) {
            sessionStorage.setItem('mafia_token', token);
            console.log('[Socket] JWT token stored');
        }
    });

    socket.on('disconnect', (reason) => {
        console.warn('[Socket] Disconnected:', reason);
        updateConnectionStatus('disconnected');
        if (reason !== 'io client disconnect') {
            Utils.showToast('Connection lost. Reconnecting...', 'warning', 4000);
        }
    });

    socket.on('connect_error', (err) => {
        console.error('[Socket] Connection error:', err.message);
        updateConnectionStatus('reconnecting');
    });

    socket.on('reconnect_attempt', (n) => {
        console.log(`[Socket] Reconnect attempt #${n}`);
        updateConnectionStatus('reconnecting');
    });

    socket.on('reconnect', () => {
        console.log('[Socket] Reconnected!');
        updateConnectionStatus('connected');
        Utils.showToast('Reconnected!', 'success', 2000);
    });

    socket.on('reconnect_failed', () => {
        console.error('[Socket] Reconnect failed after max attempts');
        updateConnectionStatus('disconnected');
        Utils.showToast('Could not reconnect. Please refresh the page.', 'error', 0);
    });

    // ─── Debug: log all events in development ─────────────────────
    if (window.__MAFIA_CONFIG__?.debug || localStorage.getItem('mafia_debug') === 'true') {
        socket.onAny((event, ...args) => {
            console.log(`[Socket] ← ${event}`, args);
        });
    }

    // ─── Expose globally ─────────────────────────────────────────
    window.MafiaSocket = socket;
})();
