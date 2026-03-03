# 🎭 Mafia — Real-Time Social Deduction Game

A full-stack real-time implementation of the classic **Mafia** social deduction game, built with **Node.js + Socket.IO** (backend) and **Vanilla HTML/CSS/JS** (frontend).

## ✨ Features

- 🛜 **Real-time multiplayer** via Socket.IO WebSockets
- 🎭 **Role assignment** — Mafia, Detective, Doctor, Villager
- 🌙 **Night phase** — Mafia kills, Doctor saves, Detective investigates (all private)
- ☀️ **Day phase** — Public discussion, live vote tally, player elimination
- 🔄 **Full game loop** — Night → Day cycling until win condition
- 🔁 **Reconnect & rejoin** — 10s grace period on disconnect, full state sync
- 👑 **Host transfer** — Auto-assign new host if original host leaves
- 💬 **Day chat** — 200-char messages during discussion phase
- 🔍 **Detective private result** — Modal revealed only to Detective at dawn
- 🏆 **Win detection** — Villagers win (all Mafia dead) / Mafia wins (Mafia ≥ others)

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js 18+, Express 4, Socket.IO 4 |
| Frontend | Vanilla HTML5, CSS3, ES6+ JavaScript |
| Realtime | WebSockets (Socket.IO) |
| Store | In-memory (Phase 3: MongoDB) |

## 📁 Project Structure

```
MAFIA/
├── backend/
│   ├── server.js                 # Express + Socket.IO entry point
│   ├── config/
│   │   ├── constants.js          # All game constants & event names
│   │   └── socket-events.js      # All Socket.IO event handlers
│   ├── models/
│   │   ├── Player.js             # Player data model
│   │   ├── Room.js               # Room + phase timer model
│   │   └── GameState.js          # Game state machine
│   ├── services/
│   │   ├── game-logic.js         # Full game engine (night/day loop)
│   │   ├── role-assigner.js      # Role distribution (Fisher-Yates)
│   │   ├── vote-counter.js       # Voting & win conditions
│   │   └── room-manager.js       # In-memory room CRUD
│   ├── middleware/
│   │   ├── error-handler.js      # Global Express error handler
│   │   └── auth.js               # Auth stub (Phase 3: JWT)
│   ├── utils/
│   │   ├── logger.js             # Leveled logging
│   │   └── helpers.js            # Utilities
│   ├── .env.example              # Environment variables template
│   └── package.json
└── frontend/
    ├── index.html                # SPA shell (7 page sections)
    ├── css/
    │   ├── styles.css            # Design system tokens
    │   ├── components.css        # Page-specific components
    │   └── responsive.css        # Mobile-first breakpoints
    └── js/
        ├── utils.js              # DOM helpers, toasts, validation
        ├── socket-client.js      # Socket.IO client + reconnect
        ├── room-manager.js       # Room create/join REST + socket
        ├── game-ui.js            # Player grid, timer, vote tally
        └── main.js               # SPA routing + all socket handlers
```

## 🚀 Quick Start

### 1. Install backend dependencies
```bash
cd backend
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env if needed (defaults work out of the box)
```

### 3. Start backend
```bash
npm run dev          # Nodemon (auto-restart on changes)
# or
npm start            # Production
```

### 4. Serve frontend
```bash
# From project root
npx http-server frontend/ -p 8080 --cors
```

### 5. Open in browser
```
http://localhost:8080
```

## 🎮 Game Configuration (`.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Backend port |
| `FRONTEND_URL` | `http://localhost:8080` | CORS allowed origin |
| `MIN_PLAYERS` | `6` | Minimum players to start |
| `MAX_PLAYERS` | `20` | Room capacity |
| `NIGHT_DURATION_SECONDS` | `30` | Night phase timer |
| `DAY_DURATION_SECONDS` | `60` | Day phase timer |
| `GRACE_PERIOD_SECONDS` | `10` | Reconnect grace window |
| `ROOM_EXPIRY_MINUTES` | `30` | Idle room expiry |

> 💡 **Testing with 2 players:** Set `MIN_PLAYERS=2` in `.env`

## 🔐 Security

- **Role privacy**: Roles are **never** broadcast to other players. Private Socket.IO emissions only.
- **Server-authoritative**: All game state lives on the server. Clients cannot fake actions.
- **Input validation**: Room codes, player names, and all actions validated server-side.
- **CORS**: Locked to configured `FRONTEND_URL` in production.
- **Rate limiting**: 10 join attempts/minute per IP.

## 🗺 Roadmap

- [x] Phase 1 — Scaffold (rooms, joining, waiting room)
- [x] Phase 2 — Full game loop (night/day, actions, win conditions)
- [x] Phase 3 — MongoDB persistence, JWT auth, QR codes

