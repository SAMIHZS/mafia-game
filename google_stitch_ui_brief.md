# Mafia Game - UI Redesign Brief for Google Stitch

This document contains everything required for Google Stitch (or any AI UI builder) to completely redesign the Mafia game's user interface while strictly adhering to the project's existing technical architecture, DOM bindings, and design constraints.

## 1. Project Overview & Technical Constraints

*   **Architecture**: Single Page Application (SPA).
*   **Tech Stack**: Vanilla HTML5, CSS3, and Vanilla JavaScript (ES6+).
*   **Hard Constraints**: 
    *   **NO Frontend Frameworks**: Do not use React, Vue, Svelte, or Angular.
    *   **NO Build Tools**: Do not use Webpack, Vite, TailwindCSS, or SASS. Standard CSS only.
    *   **DOM Bindings**: The frontend logic relies heavily on `document.getElementById()`. All existing `id` attributes in the HTML **MUST** be preserved exactly as they are.
*   **Real-time Engine**: Socket.IO is used for state updates. The UI must accommodate dynamic injections of content (e.g., player grids, timers, phase banners) without requiring page reloads.

## 2. Core SPA Architecture & DOM Structure

The application operates through a single [index.html](file:///e:/project/MAFIA/frontend/index.html) file that toggles the visibility of different `<section>` elements (pages) based on game state.

### Global UI Elements
*   `#toast-container`: Container for temporary toast notifications.
*   `#connection-status`: Pill indicator for Socket.IO connection status.

### The 7 Core Screens (Pages)
The redesign must account for the following distinct sections:

1.  **Home Page (`#page-home`)**
    *   Landing screen.
    *   Contains "Create Room" (`#btn-create-room`) and "Join Room" (`#btn-join-room`) buttons.
    *   Displays brief game rules.

2.  **Create Room Page (`#page-create-room`)**
    *   Form to enter host name (`#create-room-name`).
    *   Displays generated Room Code (`#created-room-code`) and copy button.
    *   Contains a QR Code canvas (`#room-qr-code`) for mobile quick-join.

3.  **Join Room Page (`#page-join-room`)**
    *   Form for standard players to join.
    *   Inputs for Room Code (`#join-room-code`) and Player Name (`#join-room-name`).

4.  **Waiting Room / Lobby (`#page-waiting-room`)**
    *   Header showing Room Code (`#waiting-room-code`) and Player Count (`#waiting-player-count`).
    *   Dynamic Player Grid (`#waiting-player-grid`) showing who has joined.
    *   "Start Game" button (`#btn-start-game`), visible only to the host when ≥ 6 players join.

5.  **Role Reveal Page (`#page-role-reveal`)**
    *   Transitional screen shown right before the game starts.
    *   Reveals the player's secret role (`#role-reveal-name`, `#role-reveal-desc`).
    *   Contains a 3-second countdown timer (`#role-countdown`).

6.  **Main Game Page (`#page-game`)**
    *   **Phase Banner**: Displays current phase context, dynamic timer (`#game-phase-timer`), and instructions (`#game-phase-instruction`).
    *   **Death Announcement** (`#death-announcement`): Hidden by default, dynamically shows who died at the start of the day phase.
    *   **Player Grid** (`#game-player-grid`): Always visible grid showing alive/dead status of all players. Clickable during voting/targeting.
    *   **Night Action Panel** (`#night-action-panel`): Contains 4 distinct sub-panels depending on the player's role:
        *   `#panel-mafia`: Target grid and "Confirm Kill" button.
        *   `#panel-detective`: Target grid and "Investigate" button.
        *   `#panel-doctor`: Target grid and "Protect" button.
        *   `#panel-villager`: Waiting screen ("The town sleeps...").
    *   **Day Vote Panel** (`#day-vote-panel`): Shown during the day for casting elimination votes (`#btn-cast-vote`).
    *   **Detective Modal** (`#detective-modal`): Absolute overlay modal showing the investigation results.

7.  **Game Over Page (`#page-game-over`)**
    *   Results screen showing the winning team (`#game-over-winner`).
    *   Stats grid (Rounds, Night Kills, Voted Out).
    *   Final Roles table (`#final-roles-tbody`).
    *   "Play Again" and "Go Home" actions.

## 3. Design System Goals & UX Requirements

When redesigning these screens, Google Stitch should follow these UX principles:

*   **Mobile-First**: The game is primarily played on phones while sitting in a room with friends. Touch targets must be large (min 44x44px), and layouts must be responsive (single column mobile, multi-column tablet/desktop).
*   **Clarity & Privacy**: Players need to see the game state (phase, timers) instantly. Private role information must be highly visible to the user but designed so it isn't easily readable by someone glancing over their shoulder.
*   **Theming**: The requested tone is "Fun, competitive, slightly mysterious (fitting Mafia theme)". 
    *   *Night Phase*: Deep, dark tones (e.g., dark blues/purples/blacks).
    *   *Day Phase*: bright, clear tones with high contrast.
    *   Eliminated/Dead states should drastically contrast with Alive states (e.g., deeply grayed out vs. full opacity).
*   **Accessibility**: Maintain WCAG AA contrast. Use semantic HTML and ensure visually distinct interactive states (hover, focus, disabled, active).

## 4. Deliverables Expected from Google Stitch

To successfully apply the redesign, output the following:

1.  **[index.html](file:///e:/project/MAFIA/frontend/index.html)**: A fully redesigned HTML scaffold. **CRITICAL:** Every existing `id="..."` attribute from the original HTML must remain perfectly intact and attached to the correct logical element.
2.  **`css/styles.css`**: Global variables, resets, and typography.
3.  **`css/components.css`**: Styling for shared components (Buttons, Player Cards, Input fields, Modals, Spinners).
4.  **`css/responsive.css`**: Media queries ensuring perfect fluid layouts across Mobile (<640px), Tablet (640-1024px), and Desktop (>1024px).

*(Google Stitch does not need to write any JavaScript. The existing Vanilla JS will effortlessly bind to the redesigned HTML as long as the ID tags and general DOM hierarchy are preserved).*
