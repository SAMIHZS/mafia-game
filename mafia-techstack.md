# 🛠️ Mafia Game - Tech Stack & Setup Guide

**Version:** 1.0  
**Last Updated:** February 2026  
**Target:** Developers (Node.js/JavaScript experience)

---

## 1. Tech Stack Overview

```
┌──────────────────────────────────────────────────┐
│              DEPLOYMENT LAYER                    │
│  Frontend: Vercel | Backend: Render | DB: Atlas │
└──────────────────────────────────────────────────┘
                          ↑
┌──────────────────────────────────────────────────┐
│             APPLICATION LAYER                    │
│  Browser (HTML/CSS/JS) ↔ Node.js Server         │
│  Client: Vanilla JS    Server: Express+Socket.IO │
└──────────────────────────────────────────────────┘
                          ↑
┌──────────────────────────────────────────────────┐
│            COMMUNICATION LAYER                   │
│  WebSocket (Socket.IO) + HTTPS                   │
└──────────────────────────────────────────────────┘
                          ↑
┌──────────────────────────────────────────────────┐
│             DATA LAYER (Optional)                │
│  MongoDB (for persistence, Phase 2+)             │
└──────────────────────────────────────────────────┘
```

---

## 2. Frontend Stack

### 2.1 Core Technologies

| Technology | Purpose | Version | Why |
|-----------|---------|---------|-----|
| **HTML5** | Markup | N/A | Semantic structure, forms |
| **CSS3** | Styling | N/A | Flexbox, Grid, media queries |
| **Vanilla JS** | Interactivity | ES6+ | No build step, fast, lightweight |
| **Socket.IO Client** | Real-time sync | ^4.7 | Built-in reconnection, fallbacks |
| **QR Code JS** | QR generation | ^1.5 | Generate room QR codes |

### 2.2 Frontend Project Structure

```
frontend/
├── index.html              # Entry point
├── css/
│   ├── styles.css          # Global styles
│   ├── components.css      # Button, card, form styles
│   └── responsive.css      # Media queries
├── js/
│   ├── main.js             # App initialization
│   ├── socket-client.js    # WebSocket setup
│   ├── game-ui.js          # UI updates (phase, players, votes)
│   ├── room-manager.js     # Join/create room logic
│   └── utils.js            # Helper functions
├── pages/
│   ├── home.html           # Landing page
│   ├── create-room.html    # Create room page
│   ├── join-room.html      # Join room page
│   ├── waiting-room.html   # Waiting lobby
│   ├── role-reveal.html    # Role assignment screen
│   ├── game.html           # Main game UI
│   └── game-over.html      # Results screen
└── assets/
    ├── icons/              # SVG icons
    └── images/             # Logo, etc.
```

### 2.3 Frontend Dependencies

```json
{
  "devDependencies": {
    "http-server": "^14.1.1"  // For local dev
  }
}
```

**Installation:**
```bash
npm install -g http-server
# Run: http-server frontend/ -p 8080
```

### 2.4 Frontend Build (No Build Tool)

**Why no build tool?**
- MVP doesn't need bundling
- Single files load fast
- No Node.js build step on frontend
- Reduces complexity

**For production:** Use Vercel (auto-deploys, CDN, HTTPS)

---

## 3. Backend Stack

### 3.1 Core Technologies

| Technology | Purpose | Version | Why |
|-----------|---------|---------|-----|
| **Node.js** | Runtime | 18 LTS+ | JavaScript everywhere, async/await |
| **Express** | HTTP server | ^4.18 | Minimal, routing, middleware |
| **Socket.IO** | Real-time comms | ^4.7 | WebSocket wrapper, fallbacks, rooms |
| **dotenv** | Env vars | ^16 | Config management, secrets |
| **cors** | CORS middleware | ^2.8 | Cross-origin requests |
| **uuid** | ID generation | ^9 | Generate unique room IDs |

### 3.2 Backend Project Structure

```
backend/
├── server.js               # Main entry point
├── config/
│   ├── socket-events.js    # Socket.IO event handlers
│   └── constants.js        # Game constants (phases, timings, etc.)
├── models/
│   ├── Room.js             # Room class
│   ├── Player.js           # Player class
│   └── GameState.js        # Game state machine
├── services/
│   ├── game-logic.js       # Core game rules
│   ├── role-assigner.js    # Role assignment algorithm
│   ├── vote-counter.js     # Voting & elimination
│   └── room-manager.js     # Room CRUD operations
├── middleware/
│   ├── auth.js             # Basic auth (optional)
│   └── error-handler.js    # Error handling
├── utils/
│   ├── logger.js           # Logging utility
│   └── helpers.js          # Helper functions
├── .env                    # Environment variables (git-ignored)
├── .env.example            # Template
├── package.json
└── README.md
```

### 3.3 Backend Dependencies

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "socket.io": "^4.7.2",
    "dotenv": "^16.3.1",
    "cors": "^2.8.5",
    "uuid": "^9.0.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.2"
  }
}
```

### 3.4 Backend Setup Steps

**Step 1: Initialize project**
```bash
mkdir backend
cd backend
npm init -y
npm install express socket.io dotenv cors uuid
npm install --save-dev nodemon
```

**Step 2: Create .env file**
```env
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:8080
ROOM_EXPIRY_MINUTES=30
GRACE_PERIOD_SECONDS=10
```

**Step 3: Create server.js**
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

// Socket.IO connection handler
io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  socket.on('join_room', (data) => {
    // Handle room join
  });

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
  });
});

// REST endpoint for health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK' });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

**Step 4: Run server**
```bash
npx nodemon server.js
# Auto-restarts on file changes
```

---

## 4. Real-Time Communication (Socket.IO)

### 4.1 Socket.IO Setup

**Server-side initialization:**
```javascript
const io = new Server(server, {
  cors: { origin: process.env.FRONTEND_URL },
  pingInterval: 25000,
  pingTimeout: 60000,
  transports: ['websocket', 'polling']  // Fallback to polling if needed
});
```

**Client-side initialization:**
```javascript
// frontend/js/socket-client.js
const socket = io(window.location.origin, {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5
});

socket.on('connect', () => {
  console.log('Connected to server');
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
  showMessage('Connection lost. Attempting to reconnect...');
});
```

### 4.2 Event Mapping

**Join Room:**
```javascript
// Client
socket.emit('join_room', {
  code: 'ABX93D',
  name: 'Alice'
});

// Server
socket.on('join_room', (data) => {
  const room = findRoom(data.code);
  if (!room) {
    socket.emit('error', 'Room not found');
    return;
  }
  
  const player = new Player(socket.id, data.name);
  room.addPlayer(player);
  
  socket.join(data.code);
  socket.emit('joined_room', { roomId: data.code });
  io.to(data.code).emit('player_joined', player.toJSON());
});
```

**Start Game:**
```javascript
// Client
socket.emit('start_game', {});

// Server
socket.on('start_game', () => {
  const room = getRoom(socket.id);
  if (!room || room.hostId !== socket.id) {
    socket.emit('error', 'Only host can start');
    return;
  }
  
  room.assignRoles();
  room.setState('ROLE_ASSIGNED');
  
  room.players.forEach(player => {
    io.to(player.socketId).emit('your_role_is', {
      role: player.role,
      description: getRoleDescription(player.role)
    });
  });
  
  io.to(room.id).emit('game_started', {});
  setTimeout(() => startNightPhase(room), 3000);
});
```

**Full Event List:**
```javascript
// Client → Server
'join_room'         // { code, name }
'start_game'        // {}
'detective_check'   // { targetId }
'doctor_save'       // { targetId }
'mafia_kill'        // { targetId }
'cast_vote'         // { targetId }
'player_message'    // { text }
'leave_room'        // {}

// Server → Client
'room_joined'       // { roomId, playerId }
'player_joined'     // { name, count }
'your_role_is'      // { role, description }
'game_started'      // {}
'night_phase'       // { timeLeft }
'day_phase'         // { dead, timeLeft }
'player_eliminated' // { name, role }
'game_over_*'       // { winner, stats }
'sync_full_state'   // { gameState }
'error'             // { message }
```

---

## 5. Database (MongoDB - Optional for MVP)

### 5.1 When to Add DB

**Use for MVP:**
- Skip database entirely (in-memory only)
- Store rooms in `Map<roomId, Room>`
- Rooms auto-delete after 30min inactivity

**Add in Phase 2:**
- Persist game history
- Player profiles & stats
- Leaderboard

### 5.2 MongoDB Setup (When Needed)

**Install driver:**
```bash
npm install mongodb
```

**Connection string (MongoDB Atlas):**
```env
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/mafia
```

**Models (Mongoose - optional):**
```bash
npm install mongoose
```

### 5.3 Collections Schema

**Rooms Collection:**
```javascript
{
  _id: ObjectId,
  roomCode: "ABX93D",
  hostId: "socket_id_1",
  gameState: "ACTIVE",
  players: [
    { socketId: "...", name: "Alice", role: "DETECTIVE", alive: true }
  ],
  createdAt: ISODate(),
  expiresAt: ISODate(),  // TTL Index: 30 min after creation
  settings: { nightDuration: 30, dayDuration: 60 }
}
```

**GameHistory Collection:**
```javascript
{
  _id: ObjectId,
  gameId: "game_123",
  roomCode: "ABX93D",
  players: [
    { name: "Alice", role: "DETECTIVE", result: "WIN" }
  ],
  duration: 1200,  // seconds
  winner: "VILLAGERS",
  playedAt: ISODate(),
  rounds: [
    { phase: "NIGHT_1", kills: ["John"] }
  ]
}
```

---

## 6. Deployment

### 6.1 Frontend Deployment (Vercel)

**Steps:**
1. Push code to GitHub
2. Connect repo to Vercel
3. Set build settings:
   - Build command: (leave empty)
   - Output directory: `frontend`
4. Deploy

**Configuration:**
```json
// vercel.json (in root)
{
  "builds": [
    {
      "src": "frontend/**/*",
      "use": "@vercel/static"
    }
  ]
}
```

### 6.2 Backend Deployment (Render)

**Steps:**
1. Push code to GitHub
2. Connect to Render
3. Set build settings:
   - Build command: `npm install`
   - Start command: `node server.js`
4. Set environment variables
5. Deploy

**Configuration:**
```yaml
# render.yaml
services:
  - type: web
    name: mafia-backend
    env: node
    plan: free
    buildCommand: npm install
    startCommand: node server.js
    envVars:
      - key: NODE_ENV
        value: production
      - key: FRONTEND_URL
        value: https://your-frontend.vercel.app
```

### 6.3 Environment Variables (Production)

```env
# Render/Backend
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://your-frontend.vercel.app
MONGODB_URI=mongodb+srv://...
ROOM_EXPIRY_MINUTES=30
GRACE_PERIOD_SECONDS=10

# Optional
LOG_LEVEL=info
```

### 6.4 SSL/TLS

- Vercel: Automatic HTTPS
- Render: Automatic HTTPS
- WebSocket: Automatic WSS (Secure WebSocket)

---

## 7. Development Workflow

### 7.1 Local Setup

**Step 1: Clone & setup**
```bash
git clone <repo>
cd backend
npm install

# Terminal 1: Backend
npm run dev  # Uses nodemon

# Terminal 2: Frontend
cd ../frontend
npx http-server -p 8080

# Terminal 3: Browser
# Open http://localhost:8080
```

### 7.2 Environment File

**backend/.env**
```env
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:8080
ROOM_EXPIRY_MINUTES=30
```

### 7.3 Git Workflow

```bash
# Never commit .env
# Add to .gitignore:
.env
node_modules/
.DS_Store

# Commit .env.example for reference
cp .env .env.example
# Edit .env.example to remove secrets
git add .env.example
```

---

## 8. Debugging & Logging

### 8.1 Client-Side Debugging

```javascript
// Browser Console
socket.on('debug', (data) => {
  console.log('Server debug:', data);
});

// Check WebSocket state
console.log(socket.connected);  // true/false
console.log(socket.id);          // Socket ID

// Listen to socket events
socket.onAny((event, ...args) => {
  console.log(`Event: ${event}`, args);
});
```

### 8.2 Server-Side Logging

```javascript
// backend/utils/logger.js
const log = {
  info: (msg, data) => console.log(`[INFO] ${msg}`, data),
  error: (msg, err) => console.error(`[ERROR] ${msg}`, err),
  debug: (msg, data) => process.env.DEBUG && console.log(`[DEBUG] ${msg}`, data)
};

module.exports = log;
```

### 8.3 Network Inspection

**Chrome DevTools:**
- Network tab → WS (WebSocket connections)
- Filter by `socket.io`
- Inspect frames sent/received

---

## 9. Testing Strategy

### 9.1 Manual Testing

```
Test Checklist:
- [ ] Room creation (code + QR generated)
- [ ] Player join (code & QR both work)
- [ ] Real-time player list updates
- [ ] Start game (6+ players required)
- [ ] Role assignment (each player sees their own role only)
- [ ] Night phase (actions submitted, server validates)
- [ ] Day phase (voting works, highest voted eliminated)
- [ ] Win conditions (both paths work)
- [ ] Disconnect handling (player marked inactive, can rejoin)
- [ ] Mobile responsive (test on iPhone 12, iPad)
```

### 9.2 Load Testing (Optional)

```bash
npm install artillery

# Create load-test.yml
scenarios:
  - name: "Game Flow"
    flow:
      - emit: { channel: 'join_room', data: { code: 'TEST', name: 'Player' } }
      - think: 5
      - emit: { channel: 'start_game' }

# Run
artillery run load-test.yml --target http://localhost:3001
```

---

## 10. Performance Optimization

### 10.1 Frontend

```javascript
// Lazy load components
const loadGameUI = () => import('./pages/game.html');

// Debounce rapid events
function debounce(func, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), delay);
  };
}

// Cache DOM queries
const playerListEl = document.getElementById('player-list');
```

### 10.2 Backend

```javascript
// Batch socket emissions (max once per 50ms)
const updateBatcher = new Map();

socket.on('cast_vote', (data) => {
  updateBatcher.set(socket.id, data);
  
  setTimeout(() => {
    if (updateBatcher.size > 0) {
      io.to(roomId).emit('batch_update', Array.from(updateBatcher));
      updateBatcher.clear();
    }
  }, 50);
});
```

---

## 11. Security Checklist

- [ ] HTTPS enforced (Vercel + Render auto-handle)
- [ ] WSS (Secure WebSocket) enabled
- [ ] Input validation on all endpoints
- [ ] Server validates all game actions
- [ ] Roles never sent to other players
- [ ] Vote counts validated (no duplicate votes)
- [ ] Rate limiting on join attempts
- [ ] Room codes 8+ characters (non-guessable)
- [ ] Environment variables never committed
- [ ] CORS configured correctly
- [ ] Error messages don't expose sensitive info

---

## 12. Useful Commands

```bash
# Backend
npm run dev          # Start with nodemon
npm run start        # Start production
npm run build        # (If using build tool later)

# Frontend
http-server frontend/ -p 8080

# Database (when added)
mongosh "mongodb+srv://..."  # MongoDB shell

# Deployment
git push origin main  # Auto-triggers Vercel & Render
```

---

## 13. Alternative Tech Stacks (Not Recommended for This Project)

| Stack | Reason to Avoid |
|-------|-----------------|
| React + Next.js | Overkill for MVP, adds complexity |
| Python + Django | You're stronger in JS/Node.js |
| Rust + Actix | Unnecessary performance overhead |
| GraphQL | REST + WebSockets simpler for this use case |
| Kubernetes | MVP doesn't need orchestration |

---

## 14. Cost Estimate (First Year)

| Service | Free Tier | Usage | Cost |
|---------|-----------|-------|------|
| Vercel | ✅ Included | Frontend | $0 |
| Render | ✅ Limited | Backend | $0-7/mo |
| MongoDB Atlas | ✅ 512MB | When added | $0-10/mo |
| **Total** | - | MVP | **$0-17/mo** |

---

## 15. Migration to Production Tech (Phase 3+)

When scaling beyond MVP:

```
Replace In-Memory:     → MongoDB
Horizontal Scaling:    → Use Redis Adapter for Socket.IO
Load Balancing:        → Nginx or AWS ALB
Database Scaling:      → MongoDB Replica Sets
CDN for Assets:        → Cloudflare or AWS CloudFront
Monitoring:            → Sentry, DataDog, or New Relic
```

---

## Summary

**Why This Stack?**
- ✅ Minimal dependencies (fast to learn, easy to deploy)
- ✅ All JavaScript (familiar, consistent)
- ✅ Real-time out of box (Socket.IO)
- ✅ Free deployment (Vercel + Render)
- ✅ No build complexity (plain HTML/CSS/JS)
- ✅ Scales to 100K+ concurrent users (if needed)
- ✅ You can code this solo in 4-6 weeks

**Get Started:**
1. Copy tech stack to your IDE
2. Follow backend setup (Step 3)
3. Follow frontend structure
4. Start coding! 🚀

---

**Tech Stack Version:** 1.0  
**Last Updated:** February 24, 2026  
**Questions?** Refer to Socket.IO docs: https://socket.io/docs