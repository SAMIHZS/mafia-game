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

            // Countdown display
            let countdown = parseInt(document.getElementById('role-countdown')?.textContent?.match(/\d+/)?.[0]) || 3;
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
            Utils.setText('game-phase-label', '🌙 NIGHT PHASE');
            Utils.setText('game-phase-instruction', 'The town sleeps...');
            GameUI.startTimer('game-phase-timer', data.timeLeft);

            // Show role-specific night panel
            showNightPanel();

            // Hide day-only UI
            Utils.setVisible('day-vote-panel', false);
            Utils.setVisible('vote-tally-container', false);
            Utils.setVisible('chat-panel', false);
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
            Utils.setText('game-phase-label', '☀️ DAY PHASE — Round ' + data.round);
            Utils.setText('game-phase-instruction', 'Discuss and vote to eliminate a suspect!');
            GameUI.startTimer('game-phase-timer', data.timeLeft);

            // Death announcement
            showDeathAnnouncement(data.killedPlayer);

            // Hide night panel
            Utils.setVisible('night-action-panel', false);

            // Show day UI
            Utils.setVisible('day-vote-panel', true);
            Utils.setVisible('vote-tally-container', true);
            Utils.setVisible('chat-panel', true);

            // Reset vote UI
            document.getElementById('btn-cast-vote').disabled = true;
            Utils.setVisible('vote-confirmed', false);

            // Reset vote tally
            const tally = document.getElementById('vote-tally-container');
            if (tally) GameUI.renderVoteTally(tally, {}, AppState.players);

            // Build clickable player grid for voting
            updateGamePlayerGrid(true);
            updateAliveCount();
        });

        // ── vote_updated ──────────────────────────────────────────────────────
        socket.on('vote_updated', (data) => {
            const container = document.getElementById('vote-tally-container');
            if (container) GameUI.renderVoteTally(container, data.tally, AppState.players);
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
            AppState.isHost = data.isHost;
            AppState.gameState = data.gameState;
            AppState.players = data.players || [];
            AppState.mySocketId = data.playerId;
            if (data.myRole) AppState.myRole = data.myRole;

            // Restore appropriate page
            switch (data.gameState) {
                case 'WAITING_LOBBY': updateWaitingRoom(); navigateTo('waitingRoom'); break;
                case 'NIGHT_PHASE':
                    navigateTo('game');
                    setBannerPhase('night');
                    Utils.setText('game-phase-label', '🌙 NIGHT PHASE');
                    GameUI.startTimer('game-phase-timer', data.timeLeft);
                    showNightPanel();
                    updateGamePlayerGrid(false);
                    break;
                case 'DAY_PHASE':
                    navigateTo('game');
                    setBannerPhase('day');
                    Utils.setText('game-phase-label', '☀️ DAY PHASE');
                    GameUI.startTimer('game-phase-timer', data.timeLeft);
                    Utils.setVisible('day-vote-panel', true);
                    Utils.setVisible('chat-panel', true);
                    Utils.setVisible('vote-tally-container', true);
                    updateGamePlayerGrid(true);
                    break;
                case 'GAME_OVER':
                    navigateTo('gameOver');
                    break;
            }
            Utils.showToast('Reconnected and synced!', 'success', 3000);
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

        Object.values(panels).forEach(id => Utils.setVisible(id, false));
        const panelId = panels[role] || 'panel-villager';
        Utils.setVisible(panelId, true);

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
        if (!banner) return;
        banner.className = `phase-banner ${phase}-phase`;
    }

    // ─── Death Announcement ──────────────────────────────────────────────────────

    function showDeathAnnouncement(killedPlayer) {
        const el = document.getElementById('death-announcement');
        if (!el) return;

        if (killedPlayer) {
            Utils.setText('death-msg', `${killedPlayer.name} was killed last night!`);
            Utils.setText('death-role', `They were the ${killedPlayer.role}`);
            Utils.setVisible('death-announcement', true);
        } else {
            Utils.setText('death-msg', 'Nobody died last night! The doctor was busy...');
            Utils.setText('death-role', '');
            Utils.setVisible('death-announcement', true);
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
        const total = AppState.players.length;
        Utils.setText('alive-count', `(${alive} alive / ${total} total)`);
    }

    // ─── Chat ─────────────────────────────────────────────────────────────────────

    function appendChatMessage(from, text, timestamp) {
        const container = document.getElementById('chat-messages');
        if (!container) return;

        const empty = document.getElementById('chat-empty');
        if (empty) empty.style.display = 'none';

        const msg = document.createElement('div');
        msg.style.cssText = 'margin-bottom:8px;font-size:14px;';
        const timeStr = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        msg.innerHTML = `<span style="font-weight:700">${from}</span> <span style="color:#9ca3af;font-size:12px">${timeStr}</span><br/>${text}`;
        container.appendChild(msg);
        container.scrollTop = container.scrollHeight;
    }

    // ─── Waiting Room ─────────────────────────────────────────────────────────────

    function updateWaitingRoom() {
        Utils.setText('waiting-room-code', AppState.roomCode);
        const countEl = document.getElementById('waiting-player-count');
        if (countEl) countEl.textContent = `${AppState.players.length} / 20`;

        const grid = document.getElementById('waiting-player-grid');
        if (grid) GameUI.renderPlayerGrid(grid, AppState.players, AppState.mySocketId);

        const startBtn = document.getElementById('btn-start-game');
        if (startBtn) {
            const hasEnough = AppState.players.length >= 6;
            startBtn.disabled = !hasEnough;
            startBtn.textContent = hasEnough
                ? '▶ Start Game'
                : `Need ${6 - AppState.players.length} more player${AppState.players.length < 5 ? 's' : ''}`;
        }
        Utils.setVisible('btn-start-game', AppState.isHost);
        Utils.setVisible('btn-leave-room', true);
    }

    // ─── Game Over ────────────────────────────────────────────────────────────────

    function renderGameOver(data) {
        const winnerEl = document.getElementById('game-over-winner');
        if (winnerEl) {
            const isVillagers = data.winner === 'VILLAGERS_WIN';
            winnerEl.textContent = isVillagers ? '🎉 Villagers Win!' : '💀 Mafia Wins!';
            winnerEl.className = `winner-title ${isVillagers ? 'villagers' : 'mafia'}`;
        }
        const winner = document.querySelector('.winner-badge');
        if (winner) winner.textContent = data.winner === 'VILLAGERS_WIN' ? '🏆' : '💀';

        Utils.setText('stat-rounds', data.stats?.rounds || 0);
        Utils.setText('stat-kills', data.stats?.nightKills?.length || 0);
        Utils.setText('stat-eliminated', data.stats?.eliminated?.length || 0);

        const tbody = document.getElementById('final-roles-tbody');
        if (tbody && data.players) {
            tbody.innerHTML = '';
            data.players.forEach(p => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${Utils.getInitials(p.name)}</td>
                    <td>${p.name}</td>
                    <td>${p.role}</td>
                    <td>${p.alive ? '✅ Survived' : '❌ Eliminated'}</td>
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
            // Deselect in grid
            document.querySelectorAll('#game-player-grid .player-card.selected')
                .forEach(c => c.classList.remove('selected'));
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
