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

        const isWaitingRoom = container.id === 'waiting-player-grid';

        players.forEach(player => {
            const isSelf = player.socketId === mySocketId;
            const isDead = !player.alive;

            const card = document.createElement('div');

            if (isWaitingRoom) {
                // Screen 4 styled list item
                card.className = "flex items-center gap-3 bg-background-dark p-3 rounded-lg border border-surface-border group transition-colors";
                if (isSelf) card.classList.add("border-primary/30");

                const initials = Utils.getInitials(player.name);

                let markup = `
                    <div class="w-10 h-10 rounded-full bg-surface-dark flex items-center justify-center border border-white/5 transition-colors relative">
                        <span class="text-text-subtle font-bold">${initials}</span>
                    </div>
                    <div class="flex flex-col">
                        <span class="text-white font-bold text-sm truncate">${player.name}${isSelf ? ' (You)' : ''}</span>
                        <span class="text-primary text-xs font-bold tracking-widest uppercase">${player.isHost ? 'Host' : 'Ready'}</span>
                    </div>
                `;
                card.innerHTML = markup;
            } else {
                // Screen 5/6 styled card
                card.className = "player-card relative w-full aspect-[3/4] rounded-xl bg-surface-dark border shadow-lg overflow-hidden flex flex-col group transition-all duration-300";

                if (isSelf) card.classList.add("border-primary", "shadow-[0_0_15px_rgba(242,13,13,0.2)]");
                else if (options.clickable && !isDead) card.classList.add("border-surface-border", "hover:border-primary/50", "cursor-pointer");
                else card.classList.add("border-surface-border");

                if (isDead) card.classList.add("opacity-50", "grayscale");

                card.dataset.socketId = player.socketId;

                const aliveColorClass = isDead ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" : "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]";
                const initials = Utils.getInitials(player.name);

                let markup = `
                    <!-- Alive Badge -->
                    <div class="absolute top-2 right-2 w-3 h-3 rounded-full ${aliveColorClass} z-10"></div>
                    
                    <!-- Avatar Area -->
                    <div class="flex-grow bg-background-dark/50 flex items-center justify-center relative overflow-hidden avatar-area">
                        <div class="absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0.05)_0%,transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        <span class="text-4xl text-text-subtle group-hover:text-white transition-colors duration-300 font-bold tracking-tighter">${initials}</span>
                    </div>
                    
                    <!-- Player Info -->
                    <div class="h-16 bg-surface-dark border-t border-surface-border flex flex-col justify-center px-3 z-10 shrink-0">
                        <p class="text-white font-bold text-sm truncate uppercase tracking-wider">${player.name}${isSelf ? ' (You)' : ''}</p>
                        <p class="${isDead ? 'text-red-500' : 'text-primary'} text-xs font-bold uppercase tracking-widest">${isDead ? 'Dead' : (player.isHost ? 'Host' : 'Alive')}</p>
                    </div>

                    <!-- Selected Overlay -->
                    <div class="selected-overlay hidden absolute inset-0 bg-primary/20 border-2 border-primary rounded-xl z-20 pointer-events-none">
                        <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary rounded-full w-10 h-10 flex items-center justify-center text-white shadow-lg">
                            <span class="material-symbols-outlined">check</span>
                        </div>
                    </div>
                `;
                card.innerHTML = markup;

                if (options.clickable && !isDead && !isSelf) {
                    card.addEventListener('click', () => {
                        // Deselect all
                        container.querySelectorAll('.player-card').forEach(c => c.querySelector('.selected-overlay').classList.add('hidden'));
                        card.querySelector('.selected-overlay').classList.remove('hidden');
                        if (options.onPlayerClick) options.onPlayerClick(player);
                    });
                }
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
            // Format time as MM:SS if we want, but old format is just seconds. Let's keep seconds for compatibility
            el.textContent = remaining < 10 ? `00:0${remaining}` : `00:${remaining}`;

            // Color-code urgency with Tailwind
            el.classList.remove('text-white', 'text-amber-500', 'text-primary', 'animate-pulse');

            if (remaining > 10) {
                el.classList.add('text-white');
            } else if (remaining > 5) {
                el.classList.add('text-amber-500');
            } else {
                el.classList.add('text-primary', 'animate-pulse');
            }

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
        // We now ignore the container and plot votes directly on the player grid avatars
        const grid = document.getElementById('game-player-grid');
        if (!grid) return;

        // Clear existing vote badges
        grid.querySelectorAll('.vote-badge').forEach(el => el.remove());

        // Add new badges for players with votes
        Object.entries(tally).forEach(([sid, count]) => {
            if (count > 0) {
                const card = grid.querySelector(`.player-card[data-socket-id="${sid}"]`);
                if (card) {
                    const avatar = card.querySelector('.avatar-area');
                    if (avatar) {
                        const badge = document.createElement('div');
                        badge.className = 'vote-badge absolute top-2 left-2 bg-amber-500 text-white font-bold rounded-full w-8 h-8 flex items-center justify-center border-2 border-surface-dark shadow-[0_0_10px_rgba(245,158,11,0.5)] z-20';
                        badge.textContent = count;
                        avatar.appendChild(badge);
                    }
                }
            }
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

        if (icon) icon.textContent = roleData.icon || '❓';
        if (name) name.textContent = roleData.label || roleData.role;
        if (desc) desc.textContent = roleData.description || '';
        if (team) {
            team.innerHTML = `<span class="material-symbols-outlined text-sm">group</span> ${roleData.team === 'MAFIA' ? 'Mafia' : 'Villagers'}`;
            // Remove previous color classes
            team.classList.remove('text-primary', 'text-blue-400', 'bg-primary/20', 'bg-blue-400/20', 'border-primary/30', 'border-blue-400/30');

            if (roleData.team === 'MAFIA') {
                team.classList.add('text-primary', 'bg-primary/20', 'border-primary/30');
            } else {
                team.classList.add('text-blue-400', 'bg-blue-400/20', 'border-blue-400/30');
            }
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
