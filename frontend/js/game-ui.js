/**
 * frontend/js/game-ui.js
 * UI update functions for the game screen.
 * Called by main.js in response to Socket.IO events.
 *
 * Phase 2: Full implementation of night/day phase UI,
 *          vote casting, role reveal animations, timers.
 */

const GameUI = (function () {

    // ─── Player List ─────────────────────────────────────────────

    /**
     * Render the player grid in the waiting room or game screen.
     * @param {HTMLElement} container
     * @param {Array} players - Array of player public JSON objects
     * @param {string} mySocketId - Own socket ID
     * @param {object} options - { clickable, onPlayerClick }
     */
    function renderPlayerGrid(container, players, mySocketId, options = {}) {
        if (!container) return;
        container.innerHTML = '';

        players.forEach(player => {
            const isSelf = player.socketId === mySocketId;
            const isDead = !player.alive;

            const card = document.createElement('div');
            card.className = [
                'player-card',
                isSelf ? 'self' : '',
                isDead ? 'dead' : '',
                options.clickable && !isDead && !isSelf ? 'clickable' : ''
            ].join(' ').trim();

            card.dataset.socketId = player.socketId;

            // Avatar with initials
            const avatar = document.createElement('div');
            avatar.className = 'player-avatar';
            avatar.textContent = Utils.getInitials(player.name);

            // Name
            const name = document.createElement('div');
            name.className = 'player-name truncate';
            name.textContent = player.name + (isSelf ? ' (You)' : '');

            // Status
            const status = document.createElement('div');
            status.className = `player-status ${isDead ? 'status-dead' : 'status-alive'}`;
            status.textContent = isDead ? '❌ Dead' : (player.isHost ? '👑 Host' : '✅ Alive');

            card.append(avatar, name, status);

            if (options.clickable && !isDead && !isSelf) {
                card.addEventListener('click', () => {
                    // Deselect all
                    container.querySelectorAll('.player-card').forEach(c => c.classList.remove('selected'));
                    card.classList.add('selected');
                    if (options.onPlayerClick) options.onPlayerClick(player);
                });
            }

            container.appendChild(card);
        });
    }

    // ─── Phase Timer ─────────────────────────────────────────────

    let timerInterval = null;

    /**
     * Start a countdown timer. Updates DOM every second.
     * @param {string} elementId - ID of element to update
     * @param {number} seconds   - Total seconds to count down
     * @param {Function} onEnd  - Called when timer reaches 0
     */
    function startTimer(elementId, seconds, onEnd) {
        stopTimer();
        let remaining = seconds;

        const el = document.getElementById(elementId);

        function tick() {
            if (!el) return;
            el.textContent = remaining;
            // Color-code urgency
            el.className = 'phase-timer ' + (
                remaining > 10 ? 'ok' :
                    remaining > 3 ? 'warning' : 'urgent'
            );

            if (remaining <= 0) {
                stopTimer();
                if (onEnd) onEnd();
                return;
            }
            remaining--;
        }

        tick();
        timerInterval = setInterval(tick, 1000);
    }

    function stopTimer() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }

    // ─── Vote Tally ──────────────────────────────────────────────

    /**
     * Render vote tally bars.
     * @param {HTMLElement} container
     * @param {object} tally - { [socketId]: count }
     * @param {Array} players - Array of player public objects
     */
    function renderVoteTally(container, tally, players) {
        if (!container) return;

        const playerMap = {};
        players.forEach(p => { playerMap[p.socketId] = p; });

        const maxVotes = Math.max(1, ...Object.values(tally));

        container.innerHTML = '';
        const title = document.createElement('div');
        title.className = 'vote-tally-title';
        title.textContent = '📊 Current Votes';
        container.appendChild(title);

        if (Object.keys(tally).length === 0) {
            const empty = document.createElement('div');
            empty.textContent = 'No votes yet';
            empty.style.color = '#9ca3af';
            empty.style.fontSize = 'var(--size-small)';
            container.appendChild(empty);
            return;
        }

        // Sort by votes descending
        const sorted = Object.entries(tally).sort(([, a], [, b]) => b - a);

        sorted.forEach(([sid, count]) => {
            const player = playerMap[sid];
            if (!player) return;

            const row = document.createElement('div');
            row.className = 'vote-bar-row';

            const label = document.createElement('div');
            label.className = 'vote-bar-label truncate';
            label.textContent = player.name;

            const bar = document.createElement('div');
            bar.className = 'vote-bar-fill';
            bar.style.width = `${(count / maxVotes) * 100}%`;
            bar.style.maxWidth = '200px';

            const countEl = document.createElement('div');
            countEl.className = 'vote-bar-count';
            countEl.textContent = `${count} vote${count !== 1 ? 's' : ''}`;

            row.append(label, bar, countEl);
            container.appendChild(row);
        });
    }

    // ─── Connection Status ────────────────────────────────────────

    // (Handled by socket-client.js — no duplication needed here)

    // ─── Role Reveal ─────────────────────────────────────────────

    /**
     * Show the role reveal screen with animation.
     * Phase 2: Add a countdown before transitioning.
     */
    function showRoleReveal(roleData) {
        const icon = document.getElementById('role-reveal-icon');
        const name = document.getElementById('role-reveal-name');
        const desc = document.getElementById('role-reveal-desc');
        const team = document.getElementById('role-reveal-team');

        if (icon) icon.textContent = roleData.icon || '🎭';
        if (name) name.textContent = roleData.label || roleData.role;
        if (desc) desc.textContent = roleData.description || '';
        if (team) {
            team.textContent = `Team: ${roleData.team === 'MAFIA' ? '🔴 Mafia' : '🔵 Villagers'}`;
            team.style.color = roleData.team === 'MAFIA' ? 'var(--color-mafia)' : 'var(--color-primary)';
        }
    }

    // ─── Error Banner ─────────────────────────────────────────────

    /**
     * Show an error message in a given element.
     * @param {string} elementId
     * @param {string} message
     */
    function showError(elementId, message) {
        const el = document.getElementById(elementId);
        if (!el) return;
        el.innerHTML = `<span>⚠️ ${message}</span>`;
        el.classList.remove('hidden');
    }

    function hideError(elementId) {
        const el = document.getElementById(elementId);
        if (el) el.classList.add('hidden');
    }

    return {
        renderPlayerGrid,
        startTimer,
        stopTimer,
        renderVoteTally,
        showRoleReveal,
        showError,
        hideError
    };
})();

window.GameUI = GameUI;
