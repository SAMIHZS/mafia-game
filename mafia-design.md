# 🎨 Mafia Game - Design System & UI Guide

**Version:** 1.0  
**Last Updated:** February 2026  
**Audience:** Developers, Designers

---

## 1. Design Philosophy

**Principles:**
- **Clarity:** Game state always obvious (phase, timer, player status)
- **Privacy:** Role never exposed; personal info highlighted
- **Real-time:** Updates feel instant & seamless
- **Mobile-first:** Touch-friendly, responsive
- **Social:** Encourages discussion & interaction
- **Minimalist:** Avoid clutter; focus on essential info

**Tone:** Fun, competitive, slightly mysterious (fitting Mafia theme)

---

## 2. Color Palette

### 2.1 Primary Colors

```
Brand Primary:    #1e40af (Deep Blue)     → Trust, Strategy
Brand Secondary:  #7c3aed (Purple)       → Mystery, Power
Accent:           #f59e0b (Amber/Gold)   → Alerts, Important info
```

### 2.2 Status Colors

```
Alive:    #10b981 (Green)     → Healthy, Active
Dead:     #ef4444 (Red)       → Eliminated, Inactive
Voting:   #f59e0b (Amber)     → Active decision
Night:    #1f2937 (Dark Gray) → Darkness, Sleep
Day:      #fbbf24 (Yellow)    → Light, Clarity
Mafia:    #dc2626 (Dark Red)  → Danger, Threat
```

### 2.3 Utility Colors

```
Text Primary:     #1f2937 (Very Dark Gray)
Text Secondary:   #6b7280 (Medium Gray)
Text Light:       #e5e7eb (Light Gray)
Background:       #ffffff (White) / #f3f4f6 (Off-white)
Card Background:  #ffffff with 1px #e5e7eb border
Border:           #d1d5db (Light Gray)
Error:            #ef4444 (Red)
Success:          #10b981 (Green)
Warning:          #f59e0b (Amber)
```

### 2.4 Gradient Usage

```
Phase Transition: Gradient from Night (dark) → Day (light)
Button Hover:     Subtle gradient overlay (5% darker)
Card Elevation:   Box-shadow instead of gradient
```

---

## 3. Typography

### 3.1 Font Families

```
Headings:    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif
             (System fonts for fast loading)
Body:        Same as headings
Monospace:   'Courier New', monospace (for room codes)
```

### 3.2 Font Sizes & Hierarchy

```
H1 (Main Title):      48px, 700 weight → Landing page title
H2 (Section Title):   32px, 600 weight → Phase titles, room name
H3 (Subsection):      24px, 600 weight → Player name, role name
Body Large:           18px, 400 weight → Important info (timer)
Body Regular:         16px, 400 weight → Player list, messages
Body Small:           14px, 400 weight → Secondary info
Caption:              12px, 400 weight → Helper text
Monospace (Codes):    16px, 600 weight → Room code display
```

### 3.3 Line Height & Spacing

```
Headings:     1.2 (tight)
Body Text:    1.5 (readable)
Captions:     1.4 (compact)
Letter Spacing: -0.02em (headings), 0 (body)
```

---

## 4. Component Library

### 4.1 Buttons

**States:**
```
Default:    bg-blue-600, text-white, rounded-lg, 12px padding
Hover:      bg-blue-700 (darker), shadow-md
Active:     bg-blue-800, scale-95
Disabled:   opacity-50, cursor-not-allowed
```

**Sizes:**
```
Small:   px-3 py-2, font-14
Medium:  px-4 py-2, font-16 (default)
Large:   px-6 py-3, font-18
```

**Variants:**
```
Primary:      bg-blue-600, text-white
Secondary:    bg-gray-200, text-gray-900
Danger:       bg-red-600, text-white
Success:      bg-green-600, text-white
Ghost:        bg-transparent, text-blue-600, border-2 blue
```

**Example HTML:**
```html
<button class="btn btn-primary btn-lg">
  Start Game
</button>

<button class="btn btn-secondary btn-sm" disabled>
  Waiting...
</button>
```

### 4.2 Player Cards

**Purpose:** Display player status (alive/dead, role, voting status)

**Layout:**
```
┌─────────────────────┐
│  [Avatar Initials]  │
│      ALICE          │ ← Name
│   VILLAGER (hint)   │ ← Role (if yours or dead)
│   ✅ ALIVE         │ ← Status
└─────────────────────┘
```

**Variants:**
```
Alive & Not Dead:
  - Green checkmark
  - Clickable (for voting)
  - Opacity 1

Dead:
  - Red X mark
  - Grayed out (opacity 0.5)
  - Role revealed
  - Not clickable

Self:
  - Blue border or highlight
  - Role always visible
  - Prominent placement
```

**Responsive:**
- Desktop: Grid 4 per row
- Tablet: Grid 3 per row
- Mobile: Grid 2 per row

### 4.3 Timers

**Large Timer (Primary Display):**
```
┌──────────────────┐
│   🌙 NIGHT PHASE  │  ← Phase label
│      32 seconds   │  ← Time remaining (large, 48px)
│  Close your eyes  │  ← Instructions
└──────────────────┘

Color Coding:
- >10s: Green (plenty of time)
- 3-10s: Amber (hurry)
- <3s: Red (urgent)
```

**Mini Timer (Secondary Display):**
```
⏱️ 45s (smaller, 14px, gray text)
```

### 4.4 Input Fields

**Standard Input:**
```
┌──────────────────────────────┐
│ Label                        │
├──────────────────────────────┤
│ [Placeholder or value...]    │
└──────────────────────────────┘

States:
- Default: border-1px #d1d5db
- Focus: border-2px #1e40af, shadow-blue-200
- Error: border-2px #ef4444, bg-red-50
- Disabled: bg-gray-50, opacity-0.6
```

### 4.5 Modals / Dialogs

**Confirmation Modal (Vote/Action):**
```
┌─────────────────────────────────┐
│ Confirm Your Action             │
├─────────────────────────────────┤
│ You want to vote for ALICE      │
│ (Cannot change after submit)    │
├─────────────────────────────────┤
│ [Cancel]  [Confirm & Submit]    │
└─────────────────────────────────┘
```

**Error Modal:**
```
┌─────────────────────────────────┐
│ ⚠️ Error                        │
├─────────────────────────────────┤
│ Room code is invalid or full    │
├─────────────────────────────────┤
│ [Okay]                          │
└─────────────────────────────────┘
```

---

## 5. Screen Layouts

### 5.1 Home Page

```
┌─────────────────────────────────────────┐
│           MAFIA GAME 👥                 │
│     Social Deduction Party Game         │
├─────────────────────────────────────────┤
│                                         │
│  [Create Room]  [Join Room]             │
│     (Primary)      (Secondary)          │
│                                         │
│  How to play: ...                       │
│                                         │
└─────────────────────────────────────────┘
```

**Elements:**
- Logo/Title (48px, bold)
- Subtitle (18px, gray)
- Two main buttons (side by side on desktop, stacked on mobile)
- Quick rules/FAQ

### 5.2 Create Room Screen

```
┌─────────────────────────────────────────┐
│  Your Room is Ready! 🎉                │
├─────────────────────────────────────────┤
│                                         │
│  Room Code:                             │
│  ┌──────────────────────────────────┐   │
│  │     ABX93D                       │   │ ← Monospace, large
│  │  [Copy to Clipboard] [Print]     │   │
│  └──────────────────────────────────┘   │
│                                         │
│  OR Scan QR Code:                       │
│  ┌──────────────────────────────────┐   │
│  │                                  │   │
│  │    [QR CODE IMAGE HERE]          │   │
│  │                                  │   │
│  └──────────────────────────────────┘   │
│                                         │
│  Waiting for players...                 │
│  Player list:                           │
│  - You (Host) ✅                        │
│                                         │
│  [Wait for 6+ players]                  │
│  [Start Game] (disabled until 6+)       │
│  [Cancel & Go Back]                     │
│                                         │
└─────────────────────────────────────────┘
```

### 5.3 Join Room Screen

```
┌─────────────────────────────────────────┐
│  Join a Game 👋                        │
├─────────────────────────────────────────┤
│                                         │
│  Option 1: Enter Code                   │
│  ┌──────────────────────────────────┐   │
│  │ Room Code                        │   │
│  │ [ABX93D________________]         │   │ ← Auto-filled if from QR
│  └──────────────────────────────────┘   │
│                                         │
│  OR                                     │
│                                         │
│  Option 2: Scan QR                      │
│  [📱 Scan QR Code]                      │
│                                         │
│  Your Player Name:                      │
│  ┌──────────────────────────────────┐   │
│  │ [Alice______________]            │   │
│  └──────────────────────────────────┘   │
│                                         │
│  [Join Game]  [Cancel]                  │
│                                         │
└─────────────────────────────────────────┘
```

### 5.4 Waiting Room Screen

```
┌─────────────────────────────────────────┐
│  Room: ABX93D                          │
│  Players: 6/20                          │
├─────────────────────────────────────────┤
│                                         │
│  Online Players:                        │
│  ┌─────┐  ┌─────┐  ┌─────┐             │
│  │ 🧑  │  │ 👨  │  │ 👩  │             │
│  │Alice│  │ Bob │  │Carol│             │
│  └─────┘  └─────┘  └─────┘             │
│                                         │
│  ┌─────┐  ┌─────┐  ┌─────┐             │
│  │ 👤  │  │ 👤  │  │ ...  │             │
│  │David│  │ Eve  │  │ +14  │             │
│  └─────┘  └─────┘  └─────┘             │
│                                         │
│  Waiting for host to start...           │
│                                         │
│  [Leave Room]  (if not host)            │
│  [Start Game]  (if host & 6+ players)   │
│                                         │
└─────────────────────────────────────────┘
```

### 5.5 Role Assignment Screen

```
┌─────────────────────────────────────────┐
│  🎭 Your Role Revealed                 │
├─────────────────────────────────────────┤
│                                         │
│  YOU ARE A...                           │
│                                         │
│       DETECTIVE                         │
│                                         │
│  Role Description:                      │
│  Each night, you can investigate        │
│  one person to learn their role.        │
│  Use your findings to guide the         │
│  villagers to victory!                  │
│                                         │
│  ⏱️ Game starts in 3 seconds...        │
│                                         │
│  [Got It!]                              │
│                                         │
└─────────────────────────────────────────┘
```

### 5.6 Night Phase Screen

```
┌─────────────────────────────────────────┐
│  🌙 NIGHT PHASE                        │
│  ⏱️ 28 seconds remaining                │
├─────────────────────────────────────────┤
│                                         │
│  Close your eyes...                     │
│                                         │
│  You are a DETECTIVE                    │
│  Select one person to investigate:      │
│                                         │
│  ┌─────┐  ┌─────┐  ┌─────┐             │
│  │Alice│  │ Bob │  │Carol│             │
│  │ ✓   │  │     │  │     │             │
│  └─────┘  └─────┘  └─────┘             │
│                                         │
│  ┌─────┐  ┌─────┐  ┌─────┐             │
│  │David│  │ Eve  │  │Frank│             │
│  │     │  │     │  │     │             │
│  └─────┘  └─────┘  └─────┘             │
│                                         │
│  [Confirm Selection] (disabled if none) │
│                                         │
│  (Once submitted, button grays out)     │
│                                         │
└─────────────────────────────────────────┘
```

### 5.7 Day Phase Screen

```
┌─────────────────────────────────────────┐
│  ☀️ DAY PHASE                          │
│  ⏱️ 47 seconds remaining                │
├─────────────────────────────────────────┤
│                                         │
│  ⚰️ Bob was killed by Mafia!           │
│  Bob was a VILLAGER                    │
│                                         │
│  Current Vote Tally:                    │
│  Alice (2 votes) | Carol (1 vote)       │
│                                         │
│  Cast Your Vote:                        │
│                                         │
│  ┌─────┐  ┌─────┐  ┌─────┐             │
│  │Alice│  │Carol│  │David│             │
│  │  ✅  │  │     │  │     │             │
│  └─────┘  └─────┘  └─────┘             │
│                                         │
│  ┌─────┐  ┌─────┐                       │
│  │ Eve  │  │Frank│                      │
│  │     │  │     │                       │
│  └─────┘  └─────┘                       │
│                                         │
│  [Submit Vote] (disabled if not voted)  │
│                                         │
└─────────────────────────────────────────┘
```

### 5.8 Game Over Screen

```
┌─────────────────────────────────────────┐
│  🎉 GAME OVER 🎉                       │
├─────────────────────────────────────────┤
│                                         │
│  VILLAGERS WIN! 🏆                     │
│  You were a DETECTIVE                  │
│                                         │
│  Game Statistics:                       │
│  • Duration: 12 minutes 34 seconds      │
│  • Rounds: 3 nights, 3 days             │
│  • Eliminations: 5 mafia, 2 villagers   │
│                                         │
│  Final Roles:                           │
│  Alice:   DETECTIVE  ✅ (Won)           │
│  Bob:     VILLAGER   ✅ (Won)           │
│  Carol:   MAFIA      ❌ (Lost)          │
│  David:   DOCTOR     ✅ (Won)           │
│  Eve:     VILLAGER   ❌ (Eliminated)    │
│  Frank:   MAFIA      ❌ (Lost)          │
│                                         │
│  [Play Again]  [Go Home]                │
│                                         │
└─────────────────────────────────────────┘
```

---

## 6. Responsive Breakpoints

```
Mobile:     < 640px   (iPhone, small phones)
Tablet:     640-1024px (iPad, medium devices)
Desktop:    > 1024px  (Laptop, large screens)
```

**Layout Adjustments:**
```
Mobile:
  - Full width, single column
  - Larger tap targets (44x44px min)
  - Stacked buttons
  - Condensed player grid (2 cols)

Tablet:
  - 80% width, centered
  - Player grid 3-4 cols
  - Side-by-side buttons

Desktop:
  - Max 1200px width
  - Player grid 4+ cols
  - Optimized whitespace
```

---

## 7. Accessibility (A11y)

### 7.1 Contrast Ratios

- Text vs background: 4.5:1 (WCAG AA)
- UI components: 3:1 (WCAG AA)
- Large text: 3:1

### 7.2 Keyboard Navigation

- Tab through all interactive elements
- Enter/Space to activate buttons
- Arrow keys to select from lists
- Escape to close modals

### 7.3 Screen Reader Support

- Semantic HTML (`<button>`, `<nav>`, `<main>`)
- ARIA labels where needed: `aria-label="Confirm vote"`
- Role announcements: `role="status"` for live updates
- Alt text for icons: `alt="Vote count indicator"`

### 7.4 Color Independence

- Don't rely ONLY on color to convey status
- Use icons: ✅ alive, ❌ dead, ⏱️ timer
- Use text labels: "Alive", "Dead", "Your Role"

---

## 8. Animation & Transitions

### 8.1 Timing

```
Fast transitions:   150ms (state changes)
Medium transitions: 300ms (phase changes)
Slow transitions:   500ms (important reveals)
```

### 8.2 Effects

```
Button hover:      Slight shadow increase (50ms)
Page transition:   Fade in (300ms)
Phase transition:  Zoom out → Zoom in (500ms)
Player eliminated: Highlight red → Fade to gray (300ms)
Vote update:       Number highlight yellow (200ms)
```

### 8.3 Disable Animations Option

```
Respects prefers-reduced-motion:
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; }
}
```

---

## 9. Error States & Validation

### 9.1 Input Validation

```
Room Code:
  - Must be 8 characters
  - Alphanumeric only
  - Show error: "Invalid code format"

Player Name:
  - Must be 2-20 characters
  - No special characters
  - Show error: "Name must be 2-20 characters"
```

### 9.2 Error Messages

```
Styling:
  - Red border around input
  - Red text below input
  - Icon: ⚠️

Example:
  ⚠️ This name is already taken
```

### 9.3 Success Feedback

```
Styling:
  - Green checkmark ✅
  - Brief toast: "Copied to clipboard!"
  - Auto-dismiss after 3s
```

---

## 10. Dark Mode (Future)

**Consider for Phase 2:**

```
Dark Theme Colors:
  Background:   #1f2937 (dark gray)
  Surface:      #111827 (darker gray)
  Text Primary: #f3f4f6 (light gray)
  Text Muted:   #9ca3af (medium gray)
  Accent:       #60a5fa (light blue)
  
  Night Phase:  Subtle gradient to darker tones
  Day Phase:    Lighter tones with more contrast
```

---

## 11. Branding & Logo

**Logo Usage:**
- Home page header
- Favicon
- OG image for social sharing

**Wordmark:** "MAFIA" in bold, sans-serif  
**Icon:** 👥 (people) or 🎭 (mask)  
**Tagline:** "Where lies become strategy"

---

## 12. Micro-interactions

### 12.1 Copy Button
```
Click "Copy Code"
  ↓
Button text changes to "✅ Copied!"
  ↓
After 2s, reverts to "Copy Code"
```

### 12.2 Vote Confirmation
```
Click "Submit Vote"
  ↓
Opens confirmation modal
  ↓
Confirm clicked
  ↓
Button disables + shows "Vote Submitted"
  ↓
Vote tally updates in real-time
```

### 12.3 Phase Transition
```
Night Phase ends
  ↓
Screen fades to white (1s)
  ↓
Shows "Night Phase Complete!"
  ↓
Reveals Day Phase + death announcement
```

---

## 13. Mobile-Specific Design

### 13.1 Touch Targets

All clickable elements: min 44x44px (iOS standard)  
Spacing between buttons: 8px minimum

### 13.2 Safe Areas

Account for notches + home indicators  
Padding: 16px on sides, 12px top/bottom

### 13.3 Gestures

- Tap: Select player / vote
- Long-press: Show player info tooltip (optional)
- Pull-down: Refresh game state (if disconnected)

### 13.4 Mobile-Optimized Forms

```
- Full-width inputs
- Large font size (16px minimum, prevents zoom)
- Single column layout
- Stacked buttons
```

---

## 14. Design System CSS Variables

```css
/* Colors */
--color-primary: #1e40af;
--color-secondary: #7c3aed;
--color-accent: #f59e0b;
--color-success: #10b981;
--color-error: #ef4444;
--color-warning: #f59e0b;
--color-alive: #10b981;
--color-dead: #ef4444;

/* Typography */
--font-heading: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto;
--font-body: same;
--font-mono: 'Courier New', monospace;
--size-h1: 48px;
--size-h2: 32px;
--size-h3: 24px;
--size-body: 16px;
--size-small: 14px;

/* Spacing */
--space-xs: 4px;
--space-sm: 8px;
--space-md: 16px;
--space-lg: 24px;
--space-xl: 32px;

/* Borders */
--radius-sm: 4px;
--radius-md: 8px;
--radius-lg: 12px;
--border-light: 1px solid #e5e7eb;
--border-dark: 1px solid #d1d5db;

/* Shadows */
--shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
--shadow-md: 0 4px 6px rgba(0,0,0,0.1);
--shadow-lg: 0 10px 15px rgba(0,0,0,0.15);

/* Transitions */
--transition-fast: 150ms ease-in-out;
--transition-normal: 300ms ease-in-out;
--transition-slow: 500ms ease-in-out;
```

---

## 15. Design Checklist

- [ ] All colors meet WCAG AA contrast requirements
- [ ] Buttons are 44x44px minimum (mobile)
- [ ] Forms auto-focus first input
- [ ] Error messages clear & actionable
- [ ] Loading states shown (spinners, disabled buttons)
- [ ] Success feedback provided (toasts, checkmarks)
- [ ] Responsive layout tested on mobile/tablet/desktop
- [ ] Touch targets adequate spacing
- [ ] Keyboard navigation fully functional
- [ ] Screen reader labels present
- [ ] Animations respect prefers-reduced-motion
- [ ] No flash/flicker on transitions
- [ ] Page load time < 2s
- [ ] Fonts load fast (system fonts preferred)
- [ ] Icons load correctly on all browsers

---

**Design System Version:** 1.0  
**Last Updated:** February 24, 2026  
**Next Review:** After Phase 1 testing

This design system ensures a consistent, accessible, and delightful user experience across all screens and devices. 🎮✨