/**
 * frontend/js/main.js
 * SPA controller — Phase 2 full implementation.
 * Handles routing, all Socket.IO events, and game UI wiring.
 */

(function () {
    'use strict';

    // ─── App State ─────────────────────────────────────────────────────────────
    const AppState = {
        currentPage: 'home',
        players: [],
        mySocketId: null,
        myRole: null,   // { role, label, description, icon, team }
        roomCode: null,
        isHost: false,
        gameState: null,
        selectedTarget: null,   // Player object selected for action/vote
        hasActed: false,  // Night action submitted this phase
        hasVoted: false   // Day vote submitted this phase
    };

    // ─── Page Registry ─────────────────────────────────────────────────────────
    const PAGES = {
        home: 'page-home',
        createRoom: 'page-create-room',
        joinRoom: 'page-join-room',
        waitingRoom: 'page-waiting-room',
        roleReveal: 'page-role-reveal',
        game: 'page-game',
        gameOver: 'page-game-over'
    };

    function navigateTo(pageName) {
        Object.values(PAGES).forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.remove('active');
        });
        const target = document.getElementById(PAGES[pageName]);
        if (target) {
            target.classList.add('active');
            AppState.currentPage = pageName;
            window.scrollTo(0, 0);
        }
    }

    // ─── Socket Events ──────────────────────────────────────────────────────────

    function setupSocketListeners() {
        const socket = window.MafiaSocket;
        if (!socket) { console.error('[Main] MafiaSocket not ready'); return; }

        socket.on('connect', () => { AppState.mySocketId = socket.id; });

        // ── room_joined ───────────────────────────────────────────────────────
        socket.on('room_joined', (data) => {
            AppState.roomCode = data.roomId;
            AppState.isHost = data.isHost;
            AppState.players = data.players || [];
            AppState.mySocketId = data.playerId;
            updateWaitingRoom();
            navigateTo('waitingRoom');
        });

        // ── player_joined / player_left ───────────────────────────────────────
        socket.on('player_joined', (data) => {
            AppState.players = data.players || [];
            const msg = data.reconnect ? `${data.name} reconnected` : `${data.name} joined!`;
            Utils.showToast(msg, 'info', 2000);
            if (AppState.currentPage === 'waitingRoom') updateWaitingRoom();
            else updateGamePlayerGrid(false);
        });

        socket.on('player_left', (data) => {
            AppState.players = data.players || [];
            const msg = data.disconnected
                ? `${data.name} lost connection (grace period...)`
                : `${data.name} left`;
            Utils.showToast(msg, 'warning', 3000);
            if (AppState.currentPage === 'waitingRoom') updateWaitingRoom();
            else updateGamePlayerGrid(false);
        });

        // ── host_transferred ─────────────────────────────────────────────────
        socket.on('host_transferred', (data) => {
            AppState.players = data.players || [];
            if (data.newHostId === AppState.mySocketId) {
                AppState.isHost = true;
                Utils.showToast('You are now the host!', 'success', 3000);
            } else {
                Utils.showToast(`${data.newHostName} is now the host`, 'info', 3000);
            }
            if (AppState.currentPage === 'waitingRoom') updateWaitingRoom();
        });

        // ── game_started ──────────────────────────────────────────────────────
        socket.on('game_started', (data) => {
            AppState.gameState = data.phase;
            Utils.showToast('Game started! Revealing roles...', 'info', 2000);
        });

        // ── your_role_is ─────────────────────────────────────────────────────
        socket.on('your_role_is', (roleData) => {
            AppState.myRole = roleData;
            GameUI.showRoleReveal(roleData);
            navigateTo('roleReveal');

            // SF-F1: Use a static fallback if not provided, but server controls this generally
            let countdown = 3;
            const cdEl = document.getElementById('role-countdown');
            const timer = setInterval(() => {
                if (cdEl) cdEl.textContent = `Game starts in ${Math.max(0, countdown)} second${countdown !== 1 ? 's' : ''}...`;
                countdown--;
                if (countdown < 0) clearInterval(timer);
            }, 1000);
        });

        // ── night_phase ───────────────────────────────────────────────────────
        socket.on('night_phase', (data) => {
            AppState.gameState = 'NIGHT_PHASE';
            AppState.hasActed = false;
            AppState.selectedTarget = null;
            AppState.players = data.alivePlayers || AppState.players;
            navigateTo('game');
            setBannerPhase('night');
            GameUI.startTimer('game-phase-timer', data.timeLeft);

            // Show role-specific night panel
            showNightPanel();

            // Hide day-only UI
            Utils.setVisible('day-vote-panel', false);
            Utils.setVisible('death-announcement', false);

            updateGamePlayerGrid(false);
            updateAliveCount();
        });

        // ── day_phase ─────────────────────────────────────────────────────────
        socket.on('day_phase', (data) => {
            AppState.gameState = 'DAY_PHASE';
            AppState.hasVoted = false;
            AppState.selectedTarget = null;
            AppState.players = data.players || AppState.players;
            navigateTo('game');
            setBannerPhase('day');
            GameUI.startTimer('game-phase-timer', data.timeLeft);

            // Death announcement
            showDeathAnnouncement(data.killedPlayer);

            // Hide night panel
            Utils.setVisible('night-action-panel', false);

            // Show day UI
            Utils.setVisible('day-vote-panel', true);

            // Reset vote UI
            const castBtn = document.getElementById('btn-cast-vote');
            if (castBtn) castBtn.disabled = true;
            Utils.setVisible('vote-confirmed', false);

            // Reset vote tally on player grid
            GameUI.renderVoteTally(null, {}, AppState.players);

            // Build clickable player grid for voting
            updateGamePlayerGrid(true);
            updateAliveCount();
        });

        // ── vote_updated ──────────────────────────────────────────────────────
        socket.on('vote_updated', (data) => {
            GameUI.renderVoteTally(null, data.tally, AppState.players);
            Utils.showToast(`${data.voterName} voted for ${data.targetName}`, 'info', 2000);
        });

        // ── player_eliminated ─────────────────────────────────────────────────
        socket.on('player_eliminated', (data) => {
            Utils.showToast(`${data.name} was eliminated! (was ${data.role})`, 'error', 5000);
            AppState.players = AppState.players.map(p =>
                p.socketId === data.socketId ? { ...p, alive: false, role: data.role } : p
            );
            updateGamePlayerGrid(false);
            updateAliveCount();
        });

        // ── detective_result (private) ─────────────────────────────────────────
        socket.on('detective_result', (data) => {
            const resultEl = document.getElementById('detective-result-text');
            const detailEl = document.getElementById('detective-result-detail');
            const modal = document.getElementById('detective-modal');

            if (resultEl) resultEl.textContent = data.isMafia
                ? `🔴 ${data.targetName} IS Mafia!`
                : `🟢 ${data.targetName} is NOT Mafia.`;
            if (detailEl) detailEl.textContent = `Role: ${data.role}`;
            if (modal) modal.classList.add('active');
        });

        // ── action_confirmed (night action ack) ───────────────────────────────
        socket.on('action_confirmed', (data) => {
            AppState.hasActed = true;
            // Hide the role sub-panel and show the confirmation message
            ['panel-mafia', 'panel-detective', 'panel-doctor', 'panel-villager']
                .forEach(id => Utils.setVisible(id, false));
            Utils.setVisible('action-confirmed', true);
            Utils.setText('action-confirmed-msg', data.message || '✅ Action submitted!');
        });

        // ── mafia_target_updated (teammate info) ──────────────────────────────
        socket.on('mafia_target_updated', (data) => {
            const msg = document.getElementById('mafia-teammate-msg');
            if (msg) {
                msg.textContent = `${data.chosenBy} targets ${data.targetName}`;
                msg.classList.remove('hidden');
            }
        });

        // ── new_message (chat) ────────────────────────────────────────────────
        socket.on('new_message', (data) => {
            appendChatMessage(data.from, data.text, data.timestamp);
        });

        // ── sync_full_state (rejoin) ──────────────────────────────────────────
        socket.on('sync_full_state', (data) => {
            AppState.roomCode = data.roomId;
            AppState.mySocketId = data.playerId;
            AppState.isHost = data.isHost;
            AppState.gameState = data.gameState;
            AppState.players = data.players || [];
            AppState.myRole = data.myRole;

            if (data.gameState === 'WAITING_LOBBY') {
                updateWaitingRoom();
                navigateTo('waitingRoom');
            } else if (data.gameState === 'GAME_OVER') {
                navigateTo('gameOver');
            } else {
                updateGamePlayerGrid(false);
                navigateTo('game');

                if (data.gameState === 'NIGHT_PHASE') {
                    document.getElementById('game-phase-label').textContent = 'NIGHT PHASE';
                    document.getElementById('game-phase-label').className = 'text-blue-500 font-bold text-lg uppercase tracking-widest';
                    document.getElementById('game-phase-instruction').textContent = 'The town sleeps...';
                    document.getElementById('phase-icon').textContent = 'dark_mode';
                    document.getElementById('phase-icon').className = 'material-symbols-outlined text-blue-500 text-2xl';
                    document.getElementById('phase-icon-container').className = 'w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20';
                    document.getElementById('game-phase-banner').className = 'w-full bg-blue-950/40 border-b border-blue-900/40 p-4 lg:p-6 flex flex-col md:flex-row justify-between items-center gap-4 transition-colors duration-500 shadow-lg';

                    document.getElementById('day-vote-panel').classList.add('hidden');

                    if (AppState.myRole && AppState.myRole.role !== 'VILLAGER' && AppState.players.find(p => p.socketId === AppState.mySocketId)?.alive) {
                        document.getElementById('night-action-panel').classList.remove('hidden');
                        document.getElementById('action-confirmed').classList.add('hidden');
                        showNightPanel(AppState.myRole.role);
                    } else if (AppState.players.find(p => p.socketId === AppState.mySocketId)?.alive) {
                        document.getElementById('night-action-panel').classList.remove('hidden');
                        showNightPanel('VILLAGER');
                    }
                } else if (data.gameState === 'DAY_PHASE') {
                    document.getElementById('game-phase-label').textContent = 'DAY PHASE';
                    document.getElementById('game-phase-label').className = 'text-amber-500 font-bold text-lg uppercase tracking-widest';
                    document.getElementById('game-phase-instruction').textContent = 'Discuss and vote';
                    document.getElementById('phase-icon').textContent = 'light_mode';
                    document.getElementById('phase-icon').className = 'material-symbols-outlined text-amber-500 text-2xl';
                    document.getElementById('phase-icon-container').className = 'w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20';
                    document.getElementById('game-phase-banner').className = 'w-full bg-surface-dark border-b border-surface-border p-4 lg:p-6 flex flex-col md:flex-row justify-between items-center gap-4 transition-colors duration-500 shadow-lg';

                    document.getElementById('night-action-panel').classList.add('hidden');

                    if (AppState.players.find(p => p.socketId === AppState.mySocketId)?.alive) {
                        document.getElementById('day-vote-panel').classList.remove('hidden');
                        document.getElementById('btn-cast-vote').disabled = true;
                        document.getElementById('vote-confirmed').classList.add('hidden');
                    }
                }

                GameUI.startTimer('game-phase-timer', data.timeLeft);
            }
            Utils.showToast('Reconnected and synced!', 'success', 2000);
        });

        // ── game_over ─────────────────────────────────────────────────────────
        socket.on('game_over', (data) => {
            GameUI.stopTimer();
            navigateTo('gameOver');
            renderGameOver(data);
        });

        // ── error ─────────────────────────────────────────────────────────────
        socket.on('error', (data) => {
            Utils.showToast(data.message || 'An error occurred', 'error', 5000);
        });
    }

    // ─── Night Phase UI ─────────────────────────────────────────────────────────

    function showNightPanel() {
        Utils.setVisible('night-action-panel', true);
        Utils.setVisible('action-confirmed', false);

        const role = AppState.myRole?.role;
        const panels = {
            'MAFIA': 'panel-mafia',
            'DETECTIVE': 'panel-detective',
            'DOCTOR': 'panel-doctor',
            'VILLAGER': 'panel-villager'
        };

        Object.values(panels).forEach(id => {
            const panelEl = document.getElementById(id);
            if (panelEl) { panelEl.classList.add('hidden'); panelEl.classList.remove('flex'); }
        });
        const panelId = panels[role] || 'panel-villager';
        const activePanel = document.getElementById(panelId);
        if (activePanel) { activePanel.classList.remove('hidden'); activePanel.classList.add('flex'); }

        // Populate target grids for special roles
        const alive = AppState.players.filter(p => p.alive);

        if (role === 'MAFIA') {
            const targets = alive.filter(p => p.socketId !== AppState.mySocketId && p.role !== 'MAFIA');
            populateNightTargetGrid('mafia-target-grid', targets, (player) => {
                AppState.selectedTarget = player;
                document.getElementById('btn-mafia-kill').disabled = false;
            });
        }
        if (role === 'DETECTIVE') {
            const targets = alive.filter(p => p.socketId !== AppState.mySocketId);
            populateNightTargetGrid('detective-target-grid', targets, (player) => {
                AppState.selectedTarget = player;
                document.getElementById('btn-detective-check').disabled = false;
            });
        }
        if (role === 'DOCTOR') {
            // Doctor can protect anyone including themselves
            populateNightTargetGrid('doctor-target-grid', alive, (player) => {
                AppState.selectedTarget = player;
                document.getElementById('btn-doctor-save').disabled = false;
            });
        }
    }

    function populateNightTargetGrid(gridId, players, onSelect) {
        const grid = document.getElementById(gridId);
        if (!grid) return;
        GameUI.renderPlayerGrid(grid, players, AppState.mySocketId, {
            clickable: true,
            onPlayerClick: onSelect
        });
    }

    // ─── Phase Banner ────────────────────────────────────────────────────────────

    function setBannerPhase(phase) {
        const banner = document.getElementById('game-phase-banner');
        const label = document.getElementById('game-phase-label');
        const instruction = document.getElementById('game-phase-instruction');
        const icon = document.getElementById('phase-icon');
        const iconContainer = document.getElementById('phase-icon-container');
        if (!banner) return;

        if (phase === 'night') {
            banner.className = 'w-full bg-blue-950/40 border-b border-blue-900/40 p-4 lg:p-6 flex flex-col md:flex-row justify-between items-center gap-4 transition-colors duration-500 shadow-lg';
            if (label) { label.textContent = 'NIGHT PHASE'; label.className = 'text-blue-500 font-bold text-lg uppercase tracking-widest'; }
            if (instruction) instruction.textContent = 'The town sleeps...';
            if (icon) { icon.textContent = 'dark_mode'; icon.className = 'material-symbols-outlined text-blue-500 text-2xl'; }
            if (iconContainer) iconContainer.className = 'w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20';
        } else {
            banner.className = 'w-full bg-surface-dark border-b border-surface-border p-4 lg:p-6 flex flex-col md:flex-row justify-between items-center gap-4 transition-colors duration-500 shadow-lg';
            if (label) { label.textContent = 'DAY PHASE'; label.className = 'text-amber-500 font-bold text-lg uppercase tracking-widest'; }
            if (instruction) instruction.textContent = 'Discuss and vote to eliminate a suspect!';
            if (icon) { icon.textContent = 'light_mode'; icon.className = 'material-symbols-outlined text-amber-500 text-2xl'; }
            if (iconContainer) iconContainer.className = 'w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20';
        }
    }

    // ─── Death Announcement ──────────────────────────────────────────────────────

    function showDeathAnnouncement(killedPlayer) {
        const el = document.getElementById('death-announcement');
        if (!el) return;

        // Show the element
        el.classList.remove('hidden');

        if (killedPlayer) {
            Utils.setText('death-msg', `${killedPlayer.name} was eliminated!`);
            Utils.setText('death-role', `${killedPlayer.role}`);
        } else {
            Utils.setText('death-msg', 'The night was quiet... no one died.');
            Utils.setText('death-role', '');
        }
    }

    // ─── Game Player Grid ─────────────────────────────────────────────────────────

    function updateGamePlayerGrid(clickableForVote) {
        const grid = document.getElementById('game-player-grid');
        if (!grid) return;

        const isDead = !AppState.players.find(p => p.socketId === AppState.mySocketId)?.alive;

        GameUI.renderPlayerGrid(grid, AppState.players, AppState.mySocketId, {
            clickable: clickableForVote && !AppState.hasVoted && !isDead,
            onPlayerClick: (player) => {
                AppState.selectedTarget = player;
                document.getElementById('btn-cast-vote').disabled = false;
            }
        });
    }

    function updateAliveCount() {
        const alive = AppState.players.filter(p => p.alive).length;
        Utils.setText('alive-count', alive);
    }

    // ─── Chat ─────────────────────────────────────────────────────────────────────

    function appendChatMessage(from, text, timestamp) {
        const container = document.getElementById('chat-messages');
        if (!container) return;

        const empty = document.getElementById('chat-empty');
        if (empty) empty.classList.add('hidden');

        const msg = document.createElement('div');
        msg.className = 'mb-2 text-sm';
        const timeStr = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        msg.innerHTML = `<span class="font-bold text-white">${from}</span> <span class="text-text-subtle text-xs">${timeStr}</span><br/><span class="text-slate-300">${text}</span>`;
        container.appendChild(msg);
        container.scrollTop = container.scrollHeight;
    }

    // ─── Waiting Room ─────────────────────────────────────────────────────────────

    function updateWaitingRoom() {
        Utils.setText('waiting-room-code', AppState.roomCode);
        // Update both count elements
        const countEl = document.getElementById('waiting-player-count');
        const countEl2 = document.getElementById('player-count');
        if (countEl) countEl.textContent = `${AppState.players.length} / 20`;
        if (countEl2) countEl2.textContent = AppState.players.length;

        const grid = document.getElementById('waiting-player-grid');
        if (grid) GameUI.renderPlayerGrid(grid, AppState.players, AppState.mySocketId);

        const startBtn = document.getElementById('btn-start-game');
        if (startBtn) {
            const hasEnough = AppState.players.length >= 6;
            startBtn.disabled = !hasEnough;
            if (!hasEnough) {
                startBtn.innerHTML = `Need ${6 - AppState.players.length} more player${AppState.players.length < 5 ? 's' : ''}`;
            } else {
                startBtn.innerHTML = '<span class="material-symbols-outlined">play_arrow</span> Start Game';
            }
        }
        Utils.setVisible('btn-start-game', AppState.isHost);

        // Generate QR code for lobby sharing
        if (AppState.roomCode && typeof window.generateRoomQR === 'function') {
            window.generateRoomQR(AppState.roomCode);
        }
    }

    // ─── Game Over ────────────────────────────────────────────────────────────────

    function renderGameOver(data) {
        const winnerEl = document.getElementById('game-over-winner');
        if (winnerEl) {
            const isVillagers = data.winner === 'VILLAGERS_WIN';
            winnerEl.textContent = isVillagers ? 'VILLAGERS WON' : 'MAFIA WON';
            winnerEl.className = `text-5xl md:text-7xl font-black uppercase tracking-tighter drop-shadow-[0_0_20px_rgba(255,255,255,0.3)] ${isVillagers ? 'text-blue-500' : 'text-red-500'}`;
        }

        Utils.setText('stat-rounds', data.stats?.rounds || 0);
        Utils.setText('stat-kills', data.stats?.nightKills?.length || 0);
        Utils.setText('stat-eliminated', data.stats?.eliminated?.length || 0);

        const tbody = document.getElementById('final-roles-tbody');
        if (tbody && data.players) {
            tbody.innerHTML = '';
            data.players.forEach(p => {
                const tr = document.createElement('tr');
                tr.className = "border-b border-surface-border/50 hover:bg-white/5 transition-colors";

                const roleColor = p.role === 'MAFIA' ? 'text-red-500' : 'text-primary';
                const statusColor = p.alive ? 'text-green-500' : 'text-text-subtle';

                tr.innerHTML = `
                    <td class="p-4 text-center">
                        <div class="w-8 h-8 rounded-full bg-surface-dark flex items-center justify-center border border-white/10 mx-auto">
                            <span class="text-xs font-bold text-text-subtle">${Utils.getInitials(p.name)}</span>
                        </div>
                    </td>
                    <td class="p-4 font-bold text-white">${p.name}</td>
                    <td class="p-4 font-bold ${roleColor} tracking-widest uppercase text-xs">${p.role}</td>
                    <td class="p-4 text-right font-bold tracking-widest uppercase text-xs ${statusColor}">${p.alive ? 'Survived' : 'Eliminated'}</td>
                `;
                tbody.appendChild(tr);
            });
        }
    }

    // ─── Page Setup ──────────────────────────────────────────────────────────────

    function setupHomePage() {
        document.getElementById('btn-create-room')?.addEventListener('click', () => navigateTo('createRoom'));
        document.getElementById('btn-join-room')?.addEventListener('click', () => {
            navigateTo('joinRoom');
            setTimeout(() => document.getElementById('join-room-code')?.focus(), 100);
        });
    }

    function setupCreateRoomPage() {
        const backBtn = document.getElementById('create-room-back');
        const nameInput = document.getElementById('create-room-name');
        const form = document.getElementById('create-room-form');
        const copyBtn = document.getElementById('btn-copy-code');

        backBtn?.addEventListener('click', () => navigateTo('home'));

        form?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = nameInput?.value?.trim();
            if (!Utils.isValidPlayerName(name)) {
                Utils.showFieldError('create-room-name', 'create-room-name-error', 'Name must be 2-20 letters/numbers');
                return;
            }
            Utils.clearFieldError('create-room-name', 'create-room-name-error');

            const submitBtn = form.querySelector('[type="submit"]');
            if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Creating...'; }

            try {
                const data = await RoomManager.createRoom();
                const codeEl = document.getElementById('created-room-code');
                if (codeEl) codeEl.textContent = data.roomCode;
                document.getElementById('create-room-result')?.classList.remove('hidden');
                document.getElementById('create-room-form')?.classList.add('hidden');

                // Generate QR code for easy room sharing (Phase 3)
                if (typeof window.generateRoomQR === 'function') {
                    window.generateRoomQR(data.roomCode);
                }

                await RoomManager.joinRoom(data.roomCode, name);

            } catch (err) {
                Utils.showToast(err.message, 'error');
                document.getElementById('create-room-result')?.classList.add('hidden');
                document.getElementById('create-room-form')?.classList.remove('hidden');
                if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Create Room'; }
            }
        });

        copyBtn?.addEventListener('click', async () => {
            const code = document.getElementById('created-room-code')?.textContent;
            if (code && code !== '——————') {
                const ok = await Utils.copyToClipboard(code);
                if (ok) {
                    copyBtn.textContent = '✅ Copied!';
                    copyBtn.classList.add('copied');
                    setTimeout(() => { copyBtn.textContent = '📋 Copy Code'; copyBtn.classList.remove('copied'); }, 2000);
                }
            }
        });
    }

    function setupJoinRoomPage() {
        document.getElementById('join-room-back')?.addEventListener('click', () => navigateTo('home'));

        const urlParams = new URLSearchParams(window.location.search);
        const codeParam = urlParams.get('code') || urlParams.get('room');
        if (codeParam) {
            const input = document.getElementById('join-room-code');
            if (input) input.value = codeParam.toUpperCase();
            navigateTo('joinRoom');
        }

        document.getElementById('join-room-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const code = document.getElementById('join-room-code')?.value?.trim().toUpperCase();
            const name = document.getElementById('join-room-name')?.value?.trim();
            let hasError = false;

            if (!Utils.isValidRoomCode(code)) {
                Utils.showFieldError('join-room-code', 'join-room-code-error', 'Must be exactly 8 characters'); hasError = true;
            } else { Utils.clearFieldError('join-room-code', 'join-room-code-error'); }

            if (!Utils.isValidPlayerName(name)) {
                Utils.showFieldError('join-room-name', 'join-room-name-error', 'Name must be 2-20 letters/numbers'); hasError = true;
            } else { Utils.clearFieldError('join-room-name', 'join-room-name-error'); }

            if (hasError) return;

            const submitBtn = e.target.querySelector('[type="submit"]');
            if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Joining...'; }

            try {
                await RoomManager.joinRoom(code, name);
            } catch (err) {
                Utils.showToast(err.message, 'error');
                if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Join Game'; }
            }
        });
    }

    function setupWaitingRoomPage() {
        document.getElementById('btn-start-game')?.addEventListener('click', () => {
            window.MafiaSocket?.emit('start_game', {});
        });
        document.getElementById('btn-leave-room')?.addEventListener('click', () => {
            RoomManager.leaveRoom();
            navigateTo('home');
        });

        // QR toggle panel
        document.getElementById('btn-toggle-qr')?.addEventListener('click', () => {
            const panel = document.getElementById('waiting-qr-panel');
            const icon = document.getElementById('qr-toggle-icon');
            if (panel) {
                panel.classList.toggle('hidden');
                if (icon) icon.style.transform = panel.classList.contains('hidden') ? '' : 'rotate(180deg)';
            }
        });

        // Copy room link
        document.getElementById('btn-copy-link')?.addEventListener('click', async () => {
            const linkInput = document.getElementById('waiting-room-link');
            if (linkInput?.value) {
                const ok = await Utils.copyToClipboard(linkInput.value);
                const btn = document.getElementById('btn-copy-link');
                if (ok && btn) {
                    btn.innerHTML = '<span class="material-symbols-outlined text-sm">check</span> Copied!';
                    setTimeout(() => {
                        btn.innerHTML = '<span class="material-symbols-outlined text-sm">content_copy</span> Copy';
                    }, 2000);
                }
            }
        });

        // Native share API
        document.getElementById('btn-share-native')?.addEventListener('click', async () => {
            const link = document.getElementById('waiting-room-link')?.value;
            if (link && navigator.share) {
                try {
                    await navigator.share({
                        title: 'Join my Mafia game!',
                        text: `Join my Mafia room: ${AppState.roomCode}`,
                        url: link
                    });
                } catch (e) {
                    if (e.name !== 'AbortError') console.warn('Share failed:', e);
                }
            } else if (link) {
                // Fallback: just copy the link
                await Utils.copyToClipboard(link);
                Utils.showToast('Link copied to clipboard!', 'success', 2000);
            }
        });
    }

    function setupGamePage() {
        // ── Night action buttons ──────────────────────────────────────────────
        document.getElementById('btn-mafia-kill')?.addEventListener('click', () => {
            if (!AppState.selectedTarget) return;
            window.MafiaSocket?.emit('mafia_kill', { targetId: AppState.selectedTarget.socketId });
        });

        document.getElementById('btn-detective-check')?.addEventListener('click', () => {
            if (!AppState.selectedTarget) return;
            window.MafiaSocket?.emit('detective_check', { targetId: AppState.selectedTarget.socketId });
        });

        document.getElementById('btn-doctor-save')?.addEventListener('click', () => {
            if (!AppState.selectedTarget) return;
            window.MafiaSocket?.emit('doctor_save', { targetId: AppState.selectedTarget.socketId });
        });

        // ── Vote button ───────────────────────────────────────────────────────
        document.getElementById('btn-cast-vote')?.addEventListener('click', () => {
            if (!AppState.selectedTarget || AppState.hasVoted) return;
            window.MafiaSocket?.emit('cast_vote', { targetId: AppState.selectedTarget.socketId });
            AppState.hasVoted = true;
            document.getElementById('btn-cast-vote').disabled = true;
            Utils.setVisible('vote-confirmed', true);
            // Deselect in grid (use selected-overlay, not .selected class)
            document.querySelectorAll('#game-player-grid .player-card .selected-overlay')
                .forEach(el => el.classList.add('hidden'));
        });

        // ── Chat ──────────────────────────────────────────────────────────────
        const chatInput = document.getElementById('chat-input');
        const sendChat = document.getElementById('btn-send-chat');

        function sendMessage() {
            const text = chatInput?.value?.trim();
            if (!text) return;
            window.MafiaSocket?.emit('player_message', { text });
            chatInput.value = '';
        }

        sendChat?.addEventListener('click', sendMessage);
        chatInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
        });
    }

    function setupGameOverPage() {
        document.getElementById('btn-play-again')?.addEventListener('click', () => navigateTo('home'));
        document.getElementById('btn-go-home')?.addEventListener('click', () => {
            RoomManager.leaveRoom();
            navigateTo('home');
        });
    }

    // ─── Init ─────────────────────────────────────────────────────────────────────

    function init() {
        console.log('🎮 Mafia Game — Phase 2 booting...');

        if (!window.MafiaSocket) { console.error('[Main] Socket not ready'); return; }

        setupSocketListeners();
        setupHomePage();
        setupCreateRoomPage();
        setupJoinRoomPage();
        setupWaitingRoomPage();
        setupGamePage();
        setupGameOverPage();

        navigateTo('home');
        console.log('✅ Mafia Game Phase 2 ready!');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
