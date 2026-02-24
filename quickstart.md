# ⚡ QUICK START - Mafia Game Setup (30 Minutes)

**Goal:** Get your development environment ready to code  
**Time:** ~30 minutes  
**Difficulty:** Beginner-friendly

---

## Phase 1: Backend Setup (15 min)

### Step 1: Create Backend Folder & Initialize

```bash
# In your project root directory
mkdir backend
cd backend
npm init -y
```

### Step 2: Install Dependencies

```bash
npm install express socket.io dotenv cors uuid
npm install --save-dev nodemon
```

### Step 3: Create .env File

Create `backend/.env`:

```env
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:8080
ROOM_EXPIRY_MINUTES=30
GRACE_PERIOD_SECONDS=10
```

### Step 4: Create server.js

Create `backend/server.js`:

```javascript
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.FRONTEND_URL }
});

app.use(cors());
app.use(express.json());

// Store active rooms
const rooms = new Map();

// Socket.IO connection
io.on('connection', (socket) => {
  console.log(`✅ Player connected: ${socket.id}`);

  socket.on('join_room', (data) => {
    const { code, name } = data;
    
    if (!rooms.has(code)) {
      socket.emit('error', 'Room not found');
      return;
    }

    const room = rooms.get(code);
    const player = { socketId: socket.id, name, role: null, alive: true, hasVoted: false };
    room.players.push(player);

    socket.join(code);
    socket.emit('joined_room', { roomId: code, playerId: socket.id });
    io.to(code).emit('player_joined', { name, count: room.players.length });
    console.log(`👤 ${name} joined room ${code}`);
  });

  socket.on('disconnect', () => {
    console.log(`❌ Player disconnected: ${socket.id}`);
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Create room endpoint
app.post('/api/room', (req, res) => {
  const { v4: uuid } = require('uuid');
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  
  const room = {
    code,
    hostId: null,
    players: [],
    gameState: 'WAITING_LOBBY',
    createdAt: new Date()
  };

  rooms.set(code, room);
  console.log(`🏠 Room created: ${code}`);

  res.json({ code, qrUrl: `https://yourapp.com/join/${code}` });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket ready for connections`);
});
```

### Step 5: Test Backend

```bash
npm run dev  # or npx nodemon server.js
```

**Expected output:**
```
🚀 Server running on http://localhost:3001
📡 WebSocket ready for connections
```

✅ **Backend is running!**

---

## Phase 2: Frontend Setup (10 min)

### Step 1: Create Frontend Folder Structure

```bash
# From project root
mkdir frontend
mkdir -p frontend/css frontend/js frontend/pages frontend/assets
```

### Step 2: Create Frontend Files

**`frontend/index.html`:**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MAFIA - Social Deduction Game</title>
  <link rel="stylesheet" href="css/styles.css">
</head>
<body>
  <main id="app">
    <!-- Content loads here -->
  </main>

  <script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
  <script src="js/socket-client.js"></script>
  <script src="js/main.js"></script>
</body>
</html>
```

**`frontend/css/styles.css`:**

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #1f2937;
}

main {
  background: white;
  border-radius: 12px;
  padding: 40px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  max-width: 500px;
  width: 90%;
}

h1 {
  font-size: 48px;
  margin-bottom: 10px;
  text-align: center;
  color: #667eea;
}

.subtitle {
  text-align: center;
  color: #6b7280;
  margin-bottom: 30px;
  font-size: 18px;
}

.button-group {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

button {
  flex: 1;
  padding: 12px 20px;
  font-size: 16px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 300ms ease;
  font-weight: 600;
}

.btn-primary {
  background: #667eea;
  color: white;
}

.btn-primary:hover {
  background: #5568d3;
  transform: translateY(-2px);
  box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
}

.btn-secondary {
  background: #e5e7eb;
  color: #1f2937;
}

.btn-secondary:hover {
  background: #d1d5db;
}

.input-group {
  margin-bottom: 20px;
}

label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: #374151;
}

input {
  width: 100%;
  padding: 10px 12px;
  border: 2px solid #d1d5db;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 300ms;
}

input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.player-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 12px;
  margin: 20px 0;
}

.player-card {
  background: #f3f4f6;
  padding: 12px;
  border-radius: 8px;
  text-align: center;
  border: 2px solid transparent;
  transition: all 300ms;
}

.player-card.alive {
  border-color: #10b981;
}

.player-card.dead {
  opacity: 0.5;
  border-color: #ef4444;
}

.alert {
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 20px;
  font-weight: 600;
}

.alert-error {
  background: #fee2e2;
  color: #dc2626;
  border-left: 4px solid #dc2626;
}

.alert-success {
  background: #dcfce7;
  color: #16a34a;
  border-left: 4px solid #16a34a;
}

.timer {
  font-size: 48px;
  font-weight: 700;
  text-align: center;
  margin: 20px 0;
  color: #667eea;
}

@media (max-width: 640px) {
  main {
    padding: 20px;
  }

  h1 {
    font-size: 32px;
  }

  .button-group {
    flex-direction: column;
  }
}
```

**`frontend/js/socket-client.js`:**

```javascript
// Initialize Socket.IO connection
const socket = io(window.location.origin, {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5
});

// Connection events
socket.on('connect', () => {
  console.log('✅ Connected to server');
  document.getElementById('status').textContent = 'Connected';
});

socket.on('disconnect', () => {
  console.log('❌ Disconnected from server');
  document.getElementById('status').textContent = 'Reconnecting...';
});

socket.on('error', (message) => {
  console.error('Error:', message);
  showAlert(message, 'error');
});

// Game events
socket.on('joined_room', (data) => {
  console.log('Joined room:', data);
  loadPage('game');
});

socket.on('player_joined', (data) => {
  console.log('Player joined:', data.name);
  updatePlayerList(data.count);
});

socket.on('your_role_is', (data) => {
  console.log('Your role:', data.role);
  displayRole(data);
});

socket.on('game_started', () => {
  console.log('Game started!');
  startNightPhase();
});
```

**`frontend/js/main.js`:**

```javascript
// App initialization
const app = {
  currentRoom: null,
  currentPlayer: null,
  currentPhase: null
};

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  loadPage('home');
});

// Load different pages
function loadPage(page) {
  const app = document.getElementById('app');
  
  if (page === 'home') {
    app.innerHTML = `
      <h1>🎭 MAFIA</h1>
      <p class="subtitle">Social Deduction Party Game</p>
      <div id="status" style="text-align: center; margin-bottom: 20px; color: #10b981;">Ready</div>
      <div class="button-group">
        <button class="btn-primary" onclick="loadPage('create-room')">Create Room</button>
        <button class="btn-secondary" onclick="loadPage('join-room')">Join Room</button>
      </div>
    `;
  } 
  else if (page === 'create-room') {
    app.innerHTML = `
      <h1>Create Room</h1>
      <div id="room-code" style="display: none;">
        <p class="subtitle">Your Room Code:</p>
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; text-align: center; font-family: monospace; font-size: 32px; font-weight: bold; margin-bottom: 20px;" id="code-display"></div>
        <p style="color: #6b7280; margin-bottom: 20px;">Share this code with friends! Waiting for 6+ players...</p>
        <div class="player-list" id="player-list"></div>
        <button class="btn-primary" onclick="startGame()" id="start-btn" disabled>Start Game (6+ players)</button>
        <button class="btn-secondary" onclick="loadPage('home')">Cancel</button>
      </div>
      <div id="loading-code">
        <p style="text-align: center;">Creating room...</p>
      </div>
    `;
    createRoom();
  }
  else if (page === 'join-room') {
    app.innerHTML = `
      <h1>Join Game</h1>
      <div class="input-group">
        <label>Room Code</label>
        <input type="text" id="room-code-input" placeholder="e.g., ABX93D" maxlength="8" style="text-transform: uppercase;">
      </div>
      <div class="input-group">
        <label>Your Name</label>
        <input type="text" id="player-name-input" placeholder="Enter your name" maxlength="20">
      </div>
      <div class="button-group">
        <button class="btn-primary" onclick="joinRoom()">Join Game</button>
        <button class="btn-secondary" onclick="loadPage('home')">Back</button>
      </div>
    `;
  }
  else if (page === 'game') {
    app.innerHTML = `
      <h1>🌙 NIGHT PHASE</h1>
      <div class="timer" id="timer">30</div>
      <p style="text-align: center; margin-bottom: 20px;">Select one player:</p>
      <div class="player-list" id="game-players"></div>
      <button class="btn-primary" onclick="submitAction()" id="submit-btn" disabled>Submit</button>
    `;
  }
}

// Create room
function createRoom() {
  fetch('/api/room', { method: 'POST' })
    .then(res => res.json())
    .then(data => {
      document.getElementById('loading-code').style.display = 'none';
      document.getElementById('room-code').style.display = 'block';
      document.getElementById('code-display').textContent = data.code;
      app.currentRoom = data.code;
      socket.emit('join_room', { code: data.code, name: 'Host' });
    })
    .catch(err => {
      console.error('Failed to create room:', err);
      showAlert('Failed to create room', 'error');
    });
}

// Join room
function joinRoom() {
  const code = document.getElementById('room-code-input').value.toUpperCase();
  const name = document.getElementById('player-name-input').value;

  if (!code || !name) {
    showAlert('Please enter code and name', 'error');
    return;
  }

  socket.emit('join_room', { code, name });
}

// Start game
function startGame() {
  socket.emit('start_game', {});
}

// Submit action (for night phase)
function submitAction() {
  const selected = document.querySelector('.player-card.selected');
  if (selected) {
    socket.emit('detective_check', { targetId: selected.dataset.playerId });
  }
}

// Show alert
function showAlert(message, type = 'error') {
  const alertEl = document.createElement('div');
  alertEl.className = `alert alert-${type}`;
  alertEl.textContent = message;
  document.getElementById('app').insertBefore(alertEl, document.getElementById('app').firstChild);
  setTimeout(() => alertEl.remove(), 5000);
}

// Update player list
function updatePlayerList(count) {
  console.log(`Players online: ${count}`);
  const btn = document.getElementById('start-btn');
  if (btn) {
    btn.disabled = count < 6;
    btn.textContent = `Start Game (${count}/6 players)`;
  }
}

// Display role
function displayRole(data) {
  loadPage('game');
}

// Start night phase
function startNightPhase() {
  let time = 30;
  const interval = setInterval(() => {
    document.getElementById('timer').textContent = time;
    time--;
    if (time < 0) clearInterval(interval);
  }, 1000);
}
```

### Step 3: Start Frontend

```bash
# From project root (or new terminal tab)
npx http-server frontend/ -p 8080
```

**Output:**
```
Starting up http-server, serving ./frontend
Available on:
  http://localhost:8080
```

✅ **Frontend is running!**

---

## Phase 3: Test Connection (5 min)

### Step 1: Open Browser

Visit: `http://localhost:8080`

You should see:
```
🎭 MAFIA
Social Deduction Party Game
[Create Room] [Join Room]
```

### Step 2: Create a Room

1. Click "Create Room"
2. You'll see an 8-character code (e.g., `ABX93D`)
3. Check browser console (F12) - should show `✅ Connected to server`

### Step 3: Test Join (Second Tab)

1. Open another tab: `http://localhost:8080`
2. Click "Join Room"
3. Enter the room code you created
4. Enter a player name (e.g., "Alice")
5. Click "Join Game"

You should see "Player joined" message in first tab!

✅ **Real-time sync works!**

---

## What You Have Now

```
project/
├── backend/
│   ├── server.js          ✅ Running on :3001
│   ├── package.json
│   ├── .env
│   └── node_modules/
├── frontend/
│   ├── index.html         ✅ Running on :8080
│   ├── css/
│   │   └── styles.css
│   ├── js/
│   │   ├── socket-client.js
│   │   └── main.js
│   └── pages/
```

---

## Next Steps

1. **Read** the 4 documents you received
2. **Reference** them while building features:
   - Architecture → How WebSocket events flow
   - PRD → What features to build
   - Design → How screens look
   - Tech Stack → How to code/deploy

3. **Build** the core game logic:
   - Night Phase (role actions)
   - Day Phase (voting)
   - Win conditions

4. **Test** with the manual checklist (in Tech Stack doc)

5. **Deploy** when ready (Vercel + Render)

---

## Debugging Tips

**Backend not running?**
```bash
# Make sure you're in backend folder
cd backend
# Check port isn't taken: lsof -i :3001
# Try different port: PORT=3002 npm run dev
```

**Frontend can't connect to backend?**
```bash
# Check FRONTEND_URL in backend/.env
# Should be: http://localhost:8080
# Not: http://127.0.0.1:8080 (use localhost)
```

**WebSocket not working?**
```bash
# Open DevTools (F12)
# Network tab → filter "socket.io"
# Should see active WebSocket connection
```

---

## Common Questions

**Q: Do I need to install anything else?**  
A: Just Node.js v18+. Everything else installs via npm.

**Q: Can I use a different port?**  
A: Yes! Update .env and FRONTEND_URL accordingly.

**Q: Do I deploy now?**  
A: No, test locally first. Deploy when MVP is complete.

**Q: Where do I code the game logic?**  
A: In `backend/server.js` (Socket.IO handlers) and `frontend/js/main.js` (UI updates).

---

## Success Indicators

✅ **Backend running:** Terminal shows "🚀 Server running"  
✅ **Frontend running:** Browser shows MAFIA home screen  
✅ **Real-time sync:** Can create room and join from second tab  
✅ **Browser console:** No errors, only connection logs  
✅ **Network tab:** See "socket.io" WebSocket connection  

If all ✅, you're ready to start building!

---

**You're now set up!** 🎉

Next, read the 4 documents and start implementing features from the PRD. Good luck! 🚀