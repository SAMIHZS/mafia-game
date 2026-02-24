# 🎮 Mafia Web Game - System Architecture

## 1. High-Level Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT LAYER (Browser)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Room Join UI │  │  Game UI     │  │ WebSocket Client │  │
│  │ (QR/Code)    │  │ (Night/Day)  │  │ (Real-time sync) │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↕ WebSocket (Socket.IO)
┌─────────────────────────────────────────────────────────────┐
│                   SERVER LAYER (Node.js)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Connection   │  │ Game State   │  │ Room Manager     │  │
│  │ Handler      │  │ Machine      │  │ (CRUD Rooms)     │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│         ↓                 ↓                    ↓             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │        Game Logic Engine (Core Mafia Rules)             ││
│  │  • Role Assignment • Phase Transitions                   ││
│  │  • Vote Counting   • Elimination Logic                   ││
│  │  • Win Conditions  • Broadcasting Updates                ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                            ↕ CRUD Operations
┌─────────────────────────────────────────────────────────────┐
│                    DATA LAYER (Database)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Rooms        │  │ Game History │  │ Player Stats     │  │
│  │ (Active)     │  │ (Archive)    │  │ (Optional)       │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Real-Time Communication Flow

### 2.1 WebSocket Events Architecture

**Why WebSocket, not HTTP?**
- HTTP: ~100-500ms latency per request-response
- WebSocket: ~10-50ms bidirectional, persistent connection
- For Mafia: Instant voting, night phase coordination = critical

**Event Categories:**

| Event Type | Direction | Purpose | Example |
|-----------|-----------|---------|---------|
| **Connection** | Client ↔ Server | Join/Leave room | `socket.emit('join_room', {code, name})` |
| **Game State** | Server → Client | Update UI | `io.to(roomId).emit('game_state_update', state)` |
| **Player Action** | Client → Server | Validate action | `socket.emit('cast_vote', {votedPlayerId})` |
| **Broadcast** | Server → All | Notify group | `io.to(roomId).emit('player_eliminated', {name, role})` |
| **Private** | Server → Client | Secret info | `socket.emit('your_role', 'MAFIA')` |

### 2.2 Full Game Flow (Events Timeline)

```
ROOM CREATION
└─ Host clicks "Create Room"
   └─ Server generates 6-char code + QR
   └─ emit 'room_created' to host

PLAYER JOIN (Multiple times)
├─ Guest 1 scans QR → Server validates
├─ Server broadcasts 'player_joined' to all in room
├─ Guest 2 joins...
└─ UI updates player list in real-time

GAME START
└─ Host clicks "Start Game"
   └─ Server:
      ├─ Validates min 6 players
      ├─ Shuffles & assigns roles
      ├─ Transitions to ROLE_ASSIGNED
      ├─ Sends each player their role (PRIVATELY):
      │  "socket.emit('your_role_is', {role, description})"
      └─ Broadcasts 'game_started' to all

NIGHT PHASE #1
├─ Server broadcasts 'night_phase' {timeLeft: 30}
├─ Client UI: "Close your eyes... Detective, open your eyes first"
├─ Detective submits choice: socket.emit('detective_check', {targetId})
│  └─ Server validates: detective alive? Once per night?
│  └─ Server broadcasts 'detective_result' only to detective
├─ Doctor submits choice: socket.emit('doctor_save', {targetId})
│  └─ Server validates & records
├─ Mafia submits choice: socket.emit('mafia_kill', {targetId})
│  └─ Server validates & records
├─ Server applies kills (minus doctor saves)
└─ Server auto-transitions to DAY_PHASE after 30s

DAY PHASE #1
├─ Server broadcasts: "Player X is dead!" (or "Nobody died")
├─ Dead player immediately silenced (UI disabled)
├─ Living players see voting UI
├─ Anyone casts vote: socket.emit('vote', {targetId})
│  └─ Server validates: player alive? Not voted twice?
│  └─ Server broadcasts updated vote count
├─ Server announces 'voting_ended' when time up
├─ Server calculates highest vote: 'player_eliminated'
│  └─ Eliminated player's role revealed
└─ Server checks win conditions:
   ├─ All Mafia dead? → 'game_over_villagers_win'
   ├─ Mafia ≥ Villagers? → 'game_over_mafia_win'
   └─ Else: Sleep 3s, restart NIGHT_PHASE

RECONNECTION HANDLING
└─ Player closes tab mid-game
   └─ Server detects disconnect
   └─ Marks player as inactive (grace period 10s)
   └─ If rejoins: emit 'sync_full_state' (snapshot)
   └─ Resumes from current phase
```

---

## 3. Game State Machine

**Central concept:** Server is the SINGLE SOURCE OF TRUTH. Clients are stateless viewers.

```
                    ┌─────────────────────┐
                    │    WAITING_LOBBY    │
                    │ (Players joining)   │
                    └──────────┬──────────┘
                               │ START clicked
                               ↓
                    ┌─────────────────────┐
                    │  ROLE_ASSIGNED      │
                    │ (3s delay, UI show) │
                    └──────────┬──────────┘
                               │ 3s timer
                               ↓
                    ┌─────────────────────┐
                    │   NIGHT_PHASE       │
                    │ (30s, players sleep)│
                    └──────────┬──────────┘
                               │ 30s timer / all acted
                               ↓
                    ┌─────────────────────┐
                    │   DAY_PHASE         │
                    │ (60s, voting)       │
                    └──────────┬──────────┘
                        ╱      │      ╲
          Mafia wins   ╱        │       ╲  Villagers win
                      ╱         │        ╲
                     ↙          │         ↖
            ┌──────────────┐    │    ┌──────────────┐
            │  GAME_OVER   │    │    │  GAME_OVER   │
            │  (Mafia)     │    │    │  (Villagers) │
            └──────────────┘    │    └──────────────┘
                                │
                          (Neither condition)
                                │
                                ↓
                          Loop to NIGHT_PHASE
```

**State Transition Validation (Server-side):**
- Only host can START (validates player count)
- Only server can transition phases (timer-based)
- Invalid action attempts are rejected with reason

---

## 4. Data Models

### 4.1 Room Object
```javascript
{
  roomId: "ABX93D",           // 6-char alphanumeric
  hostId: "socket_id_1",      // Who created it
  gameState: "WAITING_LOBBY", // Current phase
  players: [
    {
      socketId: "socket_id_2",
      name: "Alice",
      role: "VILLAGER",       // Private to player
      alive: true,
      hasVoted: false,
      votedFor: null,
      lastUpdate: 1708829400000
    },
    // ...more players
  ],
  settings: {
    nightDuration: 30,        // seconds
    dayDuration: 60,
    minPlayers: 6,
    enableDoctor: true,
    enableDetective: true
  },
  gameHistory: {
    dayCount: 1,
    nightKills: ["Bob"],
    eliminated: ["Charlie"],
    detective_reveals: { "Alice": "VILLAGER" }
  },
  createdAt: 1708829400000,
  expiresAt: 1708832000000    // Auto-delete after 30 min inactivity
}
```

### 4.2 Player Object (Per-Player View)
```javascript
// What gets sent to CLIENT
{
  socketId: "socket_id_2",
  name: "Alice",
  role: "VILLAGER",           // ONLY sent privately to that player
  alive: true,
  hasVoted: false,
  isHost: false
}

// What each player sees on screen
{
  otherPlayers: [
    { name: "Bob", alive: true, role: null },    // Hidden
    { name: "Charlie", alive: false, role: "DETECTIVE" }  // Revealed after death
  ],
  yourRole: "VILLAGER",                          // Private
  gameState: "DAY_PHASE",
  timeRemaining: 45,
  voteTally: { "Bob": 2, "Alice": 1 }
}
```

### 4.3 Role Assignment Algorithm
```javascript
// Shuffle & assign based on player count
function assignRoles(playerCount) {
  const roles = [];
  
  // Mafia: ~25% of players (min 2)
  const mafiaCount = Math.max(2, Math.ceil(playerCount * 0.25));
  roles.push(...Array(mafiaCount).fill('MAFIA'));
  
  // Detectives: 1 per 6 players
  const detectiveCount = Math.ceil(playerCount / 6);
  roles.push(...Array(detectiveCount).fill('DETECTIVE'));
  
  // Doctor: if enabled (1 per 8 players)
  const doctorCount = enableDoctor ? Math.ceil(playerCount / 8) : 0;
  roles.push(...Array(doctorCount).fill('DOCTOR'));
  
  // Rest are villagers
  while (roles.length < playerCount) {
    roles.push('VILLAGER');
  }
  
  // Fisher-Yates shuffle
  return shuffle(roles);
}
```

---

## 5. Socket.IO Events Reference

### 5.1 Client-to-Server Events

| Event | Payload | Server Validation | Response |
|-------|---------|-------------------|----------|
| `join_room` | `{code, name}` | Code exists? Name unique? | `room_joined` or `error` |
| `start_game` | `{}` | Is host? Min 6 players? | `game_started` to all |
| `detective_check` | `{targetId}` | Is detective? Alive? Once/night? | Private: `detective_result` |
| `doctor_save` | `{targetId}` | Is doctor? Alive? Once/night? | None (private, after kill) |
| `mafia_kill` | `{targetId}` | Is mafia? Alive? Once/night? | None (broadcast after day) |
| `cast_vote` | `{targetId}` | Player alive? Voted once? | Broadcast: `vote_updated` |
| `player_message` | `{text}` | Not dead? Length < 200? | Broadcast: `new_message` |
| `leave_room` | `{}` | Any time | `player_left` to room |

### 5.2 Server-to-Client Events

| Event | Payload | Sent To | Purpose |
|-------|---------|---------|---------|
| `room_created` | `{roomId, qrUrl}` | Host only | Show room code |
| `player_joined` | `{name, count}` | All in room | Update player list |
| `your_role_is` | `{role, description}` | Private to player | Assign role (secret) |
| `game_started` | `{phase}` | All in room | Begin game |
| `night_phase` | `{timeLeft}` | All in room | UI: "Close eyes..." |
| `day_phase` | `{dead, timeLeft}` | All in room | Announce death + voting |
| `player_eliminated` | `{name, role}` | All in room | Vote result + reveal |
| `game_over_*` | `{winner, stats}` | All in room | Final screen |
| `sync_full_state` | `{gameState}` | Reconnecting player | State recovery |
| `error` | `{message}` | Relevant client | Error message |

---

## 6. Room Management Architecture

### 6.1 Room Lifecycle

```
CREATE (Empty)
  ├─ Expiry: 30 min inactivity
  ├─ Max capacity: 20 players
  └─ Auto-cleanup: WAITING_LOBBY + no joins for 5 min

ACTIVE (Players joined, game running)
  ├─ Persistent during gameplay
  ├─ Auto-cleanup: 5 min after GAME_OVER
  └─ Broadcast cleanup notice

DELETED
  └─ Removed from memory + DB
```

### 6.2 QR Code Generation

```javascript
// Frontend or Backend
const roomCode = "ABX93D";
const qrUrl = `https://yourapp.com/join/${roomCode}`;

// Generate QR using: qrcode npm package
const qr = QRCode.toDataURL(qrUrl);
// Displays as <img src={qr} />

// When scanned:
// → Browser opens join page
// → Code auto-filled
// → User enters name
// → Joins room
```

---

## 7. Security Architecture

### 7.1 Role Protection (CRITICAL)

```
❌ WRONG:
Client-side role storage
  → User inspects DevTools console
  → Role visible in localStorage
  → Cheats by checking role before voting

✅ CORRECT:
Private Socket Emission
  socket.emit('your_role_is', role) → Only sent to that socket
  Role NEVER sent to other players
  Role NEVER stored on frontend
  Only revealed AFTER death (optional)
```

### 7.2 Vote Integrity

```javascript
// Server-side vote validation
socket.on('cast_vote', (targetId) => {
  const player = getPlayer(socket.id);
  
  // Validation checks
  if (!player || !player.alive) return; // Dead? Reject
  if (player.hasVoted) return;           // Already voted? Reject
  if (!isInVotingPhase()) return;        // Wrong phase? Reject
  if (!playerExists(targetId)) return;   // Invalid target? Reject
  
  // Record vote (server-side)
  player.votedFor = targetId;
  player.hasVoted = true;
  
  // Broadcast updated tally (NOT individual votes)
  io.to(roomId).emit('vote_updated', {
    targetName: getPlayer(targetId).name,
    newCount: countVotesFor(targetId)
  });
});
```

### 7.3 Room Code Security

```javascript
// Generate 8+ char alphanumeric to prevent brute force
function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * 36));
  }
  return code;
}

// Rate limiting on join attempts
const joinAttempts = new Map();

socket.on('join_room', (data) => {
  const ip = socket.handshake.address;
  if (joinAttempts.get(ip) > 10) {
    return socket.emit('error', 'Too many attempts');
  }
  joinAttempts.set(ip, (joinAttempts.get(ip) || 0) + 1);
  // ... proceed with join logic
});
```

---

## 8. Error Handling & Reconnection

### 8.1 Disconnection Scenarios

| Scenario | Server Action | Client Behavior |
|----------|---------------|-----------------|
| Temporary lag | Send heartbeat | Auto-reconnect |
| Browser close | Mark inactive (10s grace) | Re-join with sync |
| Network down | Mark inactive | Show "Reconnecting..." |
| 10s no activity | Remove player | Boot from game |
| Chat timeout | None | Rejoin allowed |

### 8.2 State Sync on Reconnect

```javascript
// Client reconnects
socket.on('connect', () => {
  socket.emit('rejoin_room', {
    roomId: savedRoomId,
    socketId: oldSocketId  // Prove identity
  });
});

// Server sends full state snapshot
socket.on('rejoin_room', (data) => {
  const room = getRoom(data.roomId);
  socket.emit('sync_full_state', {
    gameState: room.gameState,
    players: filterVisiblePlayers(room.players, data.socketId),
    phase: room.currentPhase,
    timeRemaining: calculateTime(room.phaseStartTime)
  });
});
```

---

## 9. Database Schema (MongoDB Example)

### 9.1 Collections

**Rooms** (Active games)
```javascript
db.rooms.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
```

**GameHistory** (Archive for stats)
```javascript
{
  gameId: ObjectId,
  roomCode: "ABX93D",
  players: [
    { name: "Alice", role: "VILLAGER", result: "WIN" },
    { name: "Bob", role: "MAFIA", result: "LOSS" }
  ],
  duration: 1200,      // seconds
  winner: "VILLAGERS",
  playedAt: ISODate(),
  rounds: [
    { phase: "NIGHT_1", kills: ["John"] },
    { phase: "DAY_1", eliminated: "Charlie" }
  ]
}
```

---

## 10. Deployment Architecture

```
┌──────────────────────────────────────┐
│  Frontend (Static SPA)               │
│  Vercel / Netlify                    │
│  - HTML/CSS/JS                       │
│  - Socket.IO Client                  │
│  - Builds from /frontend directory   │
└────────────────────┬─────────────────┘
                     │ HTTPS + WSS
┌────────────────────┴─────────────────┐
│  Backend (Node.js + Socket.IO)       │
│  Render / Railway / Railway          │
│  - Express server                    │
│  - Socket.IO server                  │
│  - Game logic                        │
│  - Env: DB_URI, PORT, NODE_ENV       │
└────────────────────┬─────────────────┘
                     │ HTTPS
┌────────────────────┴─────────────────┐
│  Database (MongoDB)                  │
│  MongoDB Atlas / self-hosted         │
│  - Rooms collection (TTL)            │
│  - GameHistory collection            │
│  - Indexes on roomCode, createdAt    │
└─────────────────────────────────────┘
```

---

## 11. Performance Considerations

| Factor | Optimization | Target |
|--------|-------------|--------|
| **Message frequency** | Batch updates every 50ms | <50ms latency |
| **Bandwidth** | Only send changed fields | ~2KB per update |
| **Memory** | Remove inactive rooms after 30min | <100MB for 1K rooms |
| **Connections** | Use clustering for >10K concurrent | Horizontal scaling |
| **Database** | Index on roomCode, TTL on expiresAt | <10ms query |

---

## 12. API Endpoints (REST for non-real-time operations)

```
GET    /api/room/:code          → Get room info (public)
POST   /api/room                → Create room (returns code + QR)
POST   /api/room/:code/stats    → Get game history
GET    /api/health              → Server health check
```

---

## Summary

**Key Architectural Decisions:**
1. ✅ WebSockets (Socket.IO) for real-time sync
2. ✅ Server-authoritative game state (no client-side logic)
3. ✅ Private socket emissions for secret roles
4. ✅ Room-based isolation for concurrent games
5. ✅ TTL collections for auto-cleanup
6. ✅ Graceful reconnection with state recovery
7. ✅ Horizontal scaling ready (but MVP single server)

This architecture prevents cheating, handles disconnections, and scales to support hundreds of concurrent games. Ready to code? 🚀