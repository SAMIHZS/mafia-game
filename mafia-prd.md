# 📋 Mafia Game - Product Requirements Document (PRD)

**Project Name:** Mafia Social Deduction Game  
**Version:** 1.0 (MVP)  
**Status:** Development  
**Updated:** February 2026

---

## 1. Executive Summary

Build a real-time multiplayer web application where 6-15 friends play Mafia, a social deduction game. Players secretly belong to different teams (Mafia vs. Villagers) and must lie, observe, and reason to win. The app provides room-based gameplay with QR code joining, real-time synchronization, and intuitive UI for night/day phases.

**Target Users:** Social gamers, party hosts, friend groups  
**Platform:** Web (Desktop + Mobile browsers)  
**MVP Timeline:** 4-6 weeks

---

## 2. Problem Statement

**Current State:**
- Mafia is traditionally played in-person
- No equipment needed, but requires a neutral moderator
- Difficult to organize timing, phases, and voting
- No visual feedback or state synchronization across players
- Players can accidentally reveal information

**Solution:**
A web app that:
- Automates moderator role (phase timers, voting)
- Provides separate UI for each player (role privacy)
- Enables remote play
- Manages game state & prevents cheating
- Scales to multiple concurrent games

---

## 3. Core Features (MVP)

### 3.1 Room Management

**Feature:** Create & Join Rooms

**User Stories:**

1. **As a host**, I want to create a private game room so my friends can join
   - Click "Create Room"
   - System generates 6-8 character alphanumeric code (e.g., `ABX93D`)
   - Generate QR code linking to `https://app.com/join/ABX93D`
   - Display both code + QR on screen
   - Share with friends (copy text / screenshot QR)

2. **As a guest**, I want to join a room using code or QR code
   - Option A: Enter code manually
   - Option B: Scan QR code with phone camera
   - Auto-redirect to join page, code pre-filled
   - Enter player name
   - Click "Join Game"
   - See real-time player list

**Acceptance Criteria:**
- Room created within 2 seconds
- QR code generated & displayed instantly
- Code is 8+ characters (case-insensitive alphanumeric)
- Max 20 players per room
- Room auto-deletes if inactive for 30 minutes
- Player names are validated (2-20 chars, no special chars)

**UI Elements:**
- Create Room button (home page)
- Room code display (large, copyable)
- QR code image (downloadable)
- Join code input field (auto-focus)
- Player list (real-time updates)
- Leave Room button

---

### 3.2 Role Assignment

**Feature:** Secret role assignment & distribution

**User Stories:**

1. **As a host**, I want to start the game when enough players have joined
   - Min 6 players required
   - Click "Start Game" button
   - System shuffles roles and assigns secretly
   - Each player sees only their own role (private socket emission)
   - 3-second delay showing role screen

2. **As a player**, I want to know my role and what it does
   - See role name (MAFIA / DETECTIVE / DOCTOR / VILLAGER)
   - See role description + abilities
   - 3s countdown before night phase begins
   - Cannot see other players' roles (until death or game end)

**Role Distribution (for 8 players example):**
- Mafia: 2 (25% of players, min 2)
- Detective: 1 (1 per 6 players)
- Doctor: 1 (if enabled; 1 per 8 players)
- Villagers: 4 (remainder)

**Acceptance Criteria:**
- Roles correctly distributed based on player count
- Each player receives only their role (private emission)
- No player can see others' roles during gameplay
- Role descriptions are clear & concise
- 3-second "reveal" phase before first night
- Start button disabled until 6+ players

**UI Elements:**
- Player count indicator (e.g., "6/20 players")
- Start Game button (host only)
- Role reveal screen (large text, description)
- 3-second countdown timer
- Role icon/color (visual distinction)

---

### 3.3 Night Phase

**Feature:** Secret night actions (kill, check, save)

**Night Phase Flow:**

1. **UI Display:** "🌙 NIGHT PHASE - Close your eyes!"
   - 30-second timer
   - Role-specific actions appear:
     - **Mafia:** "Select one person to kill"
     - **Detective:** "Select one person to check"
     - **Doctor:** "Select one person to save"
     - **Villagers:** "Just listen... you will be notified if you are targeted"

2. **Action Submission:**
   - Each role selects a target from player list
   - Action is private (only sent to server)
   - Server validates: alive? Has action? First time this phase?
   - Submit button becomes inactive after choice

3. **Server Processing:**
   - Collects all actions simultaneously
   - Applies kills MINUS saves (doctor can prevent kill)
   - Records detective reveals (private to detective only)
   - Transitions to DAY_PHASE after 30s OR all acted

**Acceptance Criteria:**
- Night phase lasts exactly 30s (unless all acted early)
- Mafia can only kill one person per night
- Doctor can only save one person per night
- Detective can check one person per night
- Actions are validated on server
- Players cannot change action after submission
- Mafia sees each other (during mafia only selection?)
- Villagers cannot act during night
- UI prevents dead players from taking actions

**UI Elements:**
- Night phase countdown timer
- Action buttons (role-specific)
- Player list (clickable, selectable)
- Confirmation modal before submit
- "Action locked" state after submission

---

### 3.4 Day Phase

**Feature:** Discussion & voting

**Day Phase Flow:**

1. **Death Announcement:**
   - Server announces who died (if anyone)
   - Dead player's role revealed (optional but recommended)
   - Dead player immediately silenced (UI disabled)

2. **Discussion Period:**
   - 60-second timer
   - All living players see discussion timer
   - Players can chat (optional feature for MVP v1.1)
   - Optional: "Accusation" feature (accuse someone without voting yet)

3. **Voting:**
   - Each player votes once for elimination
   - Cannot vote for self
   - Cannot vote after death
   - Cannot change vote (optional: allow change)
   - Vote tally updated live (without showing individual votes)
   - Example tally display: "Bob (3 votes), Alice (2 votes)"

4. **Elimination:**
   - Player with most votes eliminated
   - Tie-breaker: player with most votes first (or random)
   - Eliminated player's role revealed
   - Player immediately silenced

**Acceptance Criteria:**
- Day phase lasts exactly 60s
- Dead players cannot vote
- Each player votes exactly once
- Vote tally visible in real-time (shows names, not identities)
- Highest vote count eliminated automatically
- Tie-breaking is consistent & fair
- Eliminated player's role revealed publicly
- UI clearly shows who is dead/alive

**UI Elements:**
- Day phase countdown timer
- Death announcement box
- Player vote buttons (clickable)
- Vote tally display (live updates)
- Eliminated player announcement
- Role reveal after elimination

---

### 3.5 Win Conditions

**Feature:** Automatic win detection & game end

**Win Conditions:**

1. **Villagers Win:** All Mafia are eliminated
   - Show: "🎉 Villagers Win!"
   - Display game stats (rounds, duration, kills)
   - Show role reveal for all players

2. **Mafia Win:** Mafia count ≥ Villager count
   - Show: "💀 Mafia Wins!"
   - Display game stats
   - Show role reveal for all players

**Acceptance Criteria:**
- Win condition checked after every elimination
- Game ends immediately when condition met
- All players shown final results
- Stats displayed: game duration, kills, final roles
- "Play Again" or "Return to Home" buttons

**UI Elements:**
- Win screen (prominent message)
- Game stats (table or summary)
- Role reveal for all players
- Play Again button (returns to lobby)
- Return Home button

---

### 3.6 Game State Display

**Feature:** Live game state UI (all phases)

**Information Shown:**
- Current phase (NIGHT / DAY / ROLE_ASSIGN / GAME_OVER)
- Timer (seconds remaining)
- Player list with status:
  - Alive/Dead
  - Role (if dead, or if it's you)
  - Your own role (always visible to you)
- Vote tally (during voting)
- Chat or system messages

**Acceptance Criteria:**
- UI updates in real-time (<100ms)
- Player status always accurate
- Timers are synchronized server-time
- No state inconsistency across players
- Responsive on mobile + desktop

**UI Elements:**
- Phase indicator badge
- Countdown timer (large, prominent)
- Player cards (status icons, names)
- Role display (personal only)
- Vote counter
- Messages/notifications area

---

## 4. Tech Requirements

### 4.1 Backend (Node.js + Express + Socket.IO)

**Must Have:**
- Express server running on port 3001
- Socket.IO for WebSocket real-time sync
- Game state machine (enforces valid transitions)
- Server-authoritative validation (all actions validated server-side)
- Room management (create, join, delete)
- Player connection/disconnection handling
- Role assignment logic
- Vote counting & tie-breaking

**Optional (Phase 2):**
- MongoDB integration
- Game history/stats storage
- Player profiles & leaderboard
- Authentication (basic for now)

### 4.2 Frontend (HTML/CSS/Vanilla JS)

**Must Have:**
- Single-page application (SPA)
- Real-time UI updates via Socket.IO
- Room creation form + QR display
- Room join form (code + QR scanner)
- Game UI (night phase, day phase, voting)
- Player list
- Timer display
- Role display (personal only)
- Responsive design (mobile + desktop)
- Error handling & user feedback

**Optional (Phase 2):**
- Chat functionality
- Animation effects
- Dark mode
- Sound effects
- Settings panel

### 4.3 Database (MongoDB - Optional for MVP)

**Could Use:**
- Store active rooms (with TTL)
- Store game history (archive)
- Store player statistics

**For MVP:** Use in-memory storage (Map/Object) for rooms

### 4.4 Deployment

**Frontend:** Vercel / Netlify (automatic deployment)  
**Backend:** Render / Railway (auto-redeploy on push)  
**Database:** MongoDB Atlas (free tier if used)

---

## 5. Non-Functional Requirements

### 5.1 Performance

- Page load: <2 seconds
- WebSocket latency: <100ms
- Real-time updates: <50ms
- Support 1000 concurrent rooms (MVP: 100)

### 5.2 Security

- Room codes: 8+ character alphanumeric (prevent brute force)
- Rate limiting on join attempts (max 10 per minute per IP)
- Roles sent privately (never exposed to other players)
- Server validates all actions (prevent cheating)
- HTTPS + WSS (Secure WebSocket)
- Input validation (player names, room codes)

### 5.3 Reliability

- Auto-reconnect on disconnect
- State recovery on rejoining
- Graceful degradation if player leaves
- Room auto-cleanup after 30 min inactivity

### 5.4 Scalability

- Stateless design (can run multiple server instances)
- Room isolation (one room doesn't affect another)
- Horizontal scaling ready (but MVP: single instance)

---

## 6. User Flows

### 6.1 Host Flow

```
1. Landing page
2. Click "Create Room"
3. See room code + QR code
4. Share with friends (copy/screenshot)
5. Wait for 6+ players to join (real-time list updates)
6. Click "Start Game"
7. See own role
8. Play game (alternate night/day phases)
9. Game ends → see results
10. Option to play again or go home
```

### 6.2 Guest Flow

```
1. Receive room code or QR link
2. Open app / scan QR
3. Enter player name
4. Click "Join Game"
5. See waiting room + other players
6. Wait for host to start
7. See own role
8. Play game (alternate night/day phases)
9. Game ends → see results
10. Option to play again or go home
```

### 6.3 In-Game Flow (Player)

```
Night Phase:
1. See "Night phase - close your eyes"
2. If you're Mafia/Doctor/Detective: select target
3. Submit action
4. Wait for day phase

Day Phase:
1. See who died (if anyone)
2. See dead player's role
3. See alive players
4. Select 1 person to vote for
5. Vote submitted → see vote tally
6. Wait for day phase to end
7. See who got eliminated
8. Repeat Night/Day until game ends
```

---

## 7. Success Metrics (MVP)

| Metric | Target | Method |
|--------|--------|--------|
| Room creation time | <2s | Manual testing |
| WebSocket latency | <100ms | Browser DevTools |
| Concurrent rooms | 10+ | Load testing |
| Mobile responsiveness | 100% | Device testing |
| Game accuracy | 100% (no bugs) | QA testing |
| User satisfaction | 4.5/5 stars | Feedback form |

---

## 8. Out of Scope (Phase 2+)

- 🚫 Player authentication / accounts
- 🚫 Game history / leaderboard
- 🚫 Chat functionality
- 🚫 Custom role creation
- 🚫 Spectator mode
- 🚫 Mobile app (web-only for MVP)
- 🚫 Payment / monetization
- 🚫 Admin dashboard

---

## 9. Timeline & Milestones

| Phase | Milestone | Duration |
|-------|-----------|----------|
| 1 | Backend setup + Room system | 1 week |
| 2 | Frontend + Join UI | 1 week |
| 3 | Game logic (Night/Day) + Voting | 1.5 weeks |
| 4 | Testing + Deployment | 0.5 weeks |
| 5 | Launch + Feedback | Ongoing |

---

## 10. Constraints & Assumptions

**Constraints:**
- MVP uses in-memory storage (not DB)
- No user authentication (anonymous game)
- Single game instance (not scalable, yet)
- No persistent history

**Assumptions:**
- Users have stable internet
- Room lifetime: 30 minutes
- Max 20 players per room
- Min 6 players to start

---

## 11. Acceptance Criteria (MVP Ready)

- ✅ Room creation with code + QR
- ✅ Player joining (code or QR)
- ✅ Real-time player list
- ✅ Role assignment & secrecy
- ✅ Night phase (actions + validation)
- ✅ Day phase (voting + elimination)
- ✅ Win condition detection
- ✅ Mobile-responsive UI
- ✅ WebSocket real-time sync (<100ms)
- ✅ Server validates all actions
- ✅ Deployed & publicly accessible
- ✅ 10+ concurrent test games work flawlessly

---

## 12. Testing Strategy

**Unit Tests:**
- Role assignment logic
- Win condition detection
- Vote counting

**Integration Tests:**
- Room creation → player join → game start
- Night phase → day phase → elimination
- Multiple rooms in parallel

**E2E Tests:**
- Full game from create room to game over
- Mobile device testing
- WebSocket reliability

**Manual QA:**
- 8+ player local test game
- Edge cases (disconnect/reconnect)
- UI/UX review
- Cross-browser testing

---

## 13. Future Enhancements (Phase 2+)

1. **Persistence:** Save game history to DB
2. **Profiles:** Player accounts with stats
3. **Roles:** More roles (Bodyguard, Witch, Hunter)
4. **Features:** Chat, timers customization, game rules
5. **UI:** Animations, themes, sound effects
6. **Analytics:** Track popular times, game stats
7. **Mobile App:** Native iOS/Android
8. **Spectators:** Watch without playing

---

## 14. Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Product Manager | [You] | 2/24/2026 | ✓ |
| Tech Lead | [You] | 2/24/2026 | ✓ |
| Designer | [You] | 2/24/2026 | ✓ |

---

**Document Version:** 1.0  
**Last Updated:** February 24, 2026  
**Next Review:** After Phase 1 completion