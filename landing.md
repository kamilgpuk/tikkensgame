# Landing & Onboarding Spec

## Scope

Four connected features that turn a confusing blank game into something a stranger can understand, enjoy, and share. No new gameplay mechanics — pure UX and communication.

---

## Feature 1 — Landing Page

A public page visible before the player enters their name. This is what gets shared on Twitter, HN, Discord. The game itself is the CTA.

### Vibe

Terminal. Like you accidentally SSHed into something that's generating tokens without you.
Black background. Green or white monospace text. No gradients, no icons, no illustrations, no animations beyond a blinking cursor. Feels like a README came to life. The kind of page that gets screenshotted and posted on X because it looks deranged in the best way.

Reference feeling: `htop`, `nethack`, old-school BBS boards, a well-written man page.

### Tech

A single standalone `landing.html` file — plain HTML + inline CSS + minimal vanilla JS. No React, no build step, no bundler. The server just serves it statically at `/`. This makes it fast, trivially editable, and copy-pasteable. The only external dependency is a monospace font (system font stack — no Google Fonts).

### Layout

Single screen on desktop, short scroll on mobile. No navbar, no footer, no chrome.

```
┌─────────────────────────────────────────────────┐
│                                                 │
│  AI HYPE MACHINE v0.1                           │
│  ──────────────────────────────────────────     │
│                                                 │
│  > idle clicker. generate tokens. build AGI.    │
│  > let Claude play for you via MCP.             │
│                                                 │
│  [ play ]   [ how it works ]                    │
│                                                 │
│  ──────────────────────────────────────────     │
│  LEADERBOARD                                    │
│   1  siliconsam      1.2M   Thought Leader      │
│   2  promptqueen     890K   Serial Entrepreneur │
│   3  you?            —      —                   │
│  ──────────────────────────────────────────     │
│                                                 │
│  tokens generated globally: 4,821,773,002       │
│  players online: 3                              │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Sections

**Header line**
- `AI HYPE MACHINE v0.1` — left aligned, plain text, looks like a terminal prompt
- No logo, no tagline widget, nothing fancy

**Pitch — two lines of green `>` prompt text**
- `> idle clicker. generate tokens. build AGI.`
- `> let Claude play for you via MCP.`
- That's it. No paragraph, no bullet points.

**CTAs — two text buttons, monospace, minimal border**
- `[ play ]` — goes to `/play` (name input + game)
- `[ how it works ]` — expands an inline text block below (no modal, no scroll jump, just `display:none` → visible), feels like a `man` page expanding

**How it works — inline expandable, hidden by default**
Plain text, no headers, like reading a terminal output:
```
WHAT IS THIS
  click [generate] to earn tokens.
  buy hardware → generates compute.
  buy models   → consumes compute, generates tokens/s.
  earn hype    → multiplies everything.
  get investors → generates funding for upgrades.
  hit 1M tokens → launch a startup (prestige).
  repeat. get faster. reach AGI.

THE MCP THING
  the game has an MCP server.
  point Claude at it and it plays for you.
  it reads game state, buys things, strategizes.
  it shows up on the leaderboard as a real player.
  → type [mcp] in the game to see setup instructions.
```

**Leaderboard — live, top 5**
- Polls `GET /api/leaderboard` every 10 seconds (no WebSocket needed on the landing page)
- Plain text table: rank, name, score, title
- If no players yet: shows placeholder row `  —  be the first`
- One line below: `tokens generated globally: 4,821,773,002` — sum of all `totalTokensEarned` across all players, also polled

**Players online count**
- One line: `players online: 3`
- Derived from active WebSocket connections, served by `GET /api/meta`

### Colours
- Background: `#000` or `#0a0a0a`
- Text: `#e0e0e0`
- Accents / prompts: `#00cc44` (terminal green)
- Muted / secondary: `#666`
- Borders: `#222` or just plain `─` characters drawn in text

### What it is NOT
- No hero image
- No animations (one exception: blinking cursor `_` after the last prompt line, pure CSS)
- No marketing copy ("the future of gaming")
- No social proof badges
- No email capture
- No cookie banner (no cookies)

---

## Feature 2 — How to Play Modal

Accessible from a persistent `?` button in the game header. Opens a fullscreen or large modal overlay.

### Sections

**The loop** (core game explained in plain English)
```
Tokens    — your main currency. Click to earn them. Spend them on everything.
Compute   — power for your models. Hardware generates it. Models consume it.
Hype      — a multiplier. Hits 0→1→5→21 as you reach token milestones.
Funding   — late-game currency from investors. Buys expensive upgrades.
```

**How to progress**
Step-by-step in plain language:
1. Click the Generate button to get your first tokens
2. Buy a Mac Mini — it generates Compute passively
3. Buy GPT-2 — it consumes Compute and generates Tokens automatically
4. Keep buying more hardware and models — balance Compute vs consumption
5. Hit token milestones to earn Hype (check the Events log)
6. Once Hype ≥ 1, investors unlock — they generate Funding
7. Spend Funding on upgrades for big multipliers
8. Hit 1M total tokens → Launch a Startup (prestige) for permanent Reputation bonus
9. Repeat — each prestige makes you faster

**Unlock system**
- Hardware unlocks by owning enough of the previous tier (e.g. 3× Mac Mini → Gaming PC)
- Models unlock by owning the matching hardware tier
- Investors unlock by reaching Hype thresholds
- Greyed-out items show what's needed to unlock them

**Prestige explained**
- What resets: tokens, compute, hardware, models, investors, upgrades
- What stays: prestige count, Reputation score, 10% of current Hype
- Why it's worth it: Reputation permanently multiplies all token generation

### Design
- Matches the game's white monospace style (not the dark terminal — the modal lives inside the game, not the landing page)
- Single scrollable block of text, no tabs — reads like a well-formatted README
- Triggered by `[?]` text button in the header (not an icon)
- Keyboard shortcut: `?` key opens/closes it
- Close button is `[ close ]` text, top right

---

## Feature 3 — Contextual Tooltips & Unlock Hints

No modal needed. Information appears where the player is already looking.

### Resource bar tooltips
Hover (or tap-and-hold on mobile) on any resource shows a one-liner:
- **Tokens** — *"Primary currency. Click to earn. Spent on everything."*
- **Compute** — *"Generated by hardware. Consumed by models. Keep it positive."*
- **Hype** — *"Global multiplier on all token generation. Never decreases."*
- **Funding** — *"Generated by investors. Spent on funding upgrades only."*
- **Reputation** — *"Permanent multiplier from prestige. Survives resets."*

### Producer unlock hints
Currently locked items (greyed out) show why they're locked:
- Instead of just grey → show small text: *"Unlock: own 3× Mac Mini"*
- Once one unit away from unlocking: highlight the hint in a different colour

### Compute warning
If `computePerSecond` is negative (models consuming more than hardware generates), show a small warning on the Compute resource:
- *"⚠ Compute deficit — models running slow"*
- This is the most common confusion new players have

### First-time hints (one-off, dismissable)
Small inline prompts that appear once and never again (stored in localStorage):
- On first load: *"Start by clicking Generate a few times, then buy a Mac Mini."*
- After first hardware purchase: *"Now buy GPT-2 — it turns Compute into Tokens automatically."*
- After first model purchase: *"Watch your Tokens/s rate go up. Keep the hardware ahead of models."*
- After first milestone: *"That's Hype. It multiplies everything. Chase more milestones."*

---

## Feature 4 — MCP Connection Tab

A dedicated tab in the game (next to the leaderboard tab). Explains how to connect an AI to play the game.

### Content

**Intro**
*"Connect Claude (or any MCP-compatible AI) and let it read your game state, buy producers, and strategize — while you watch."*

**Prerequisites checklist**
- [ ] Claude Code installed (`npm install -g @anthropic-ai/claude-code`)
- [ ] Game server running locally (you're already there)

**Auto-generated config snippet**
The tab generates the correct JSON for this specific machine, with real paths filled in:
```json
{
  "mcpServers": {
    "ai-hype-machine": {
      "command": "node",
      "args": ["/Users/yourname/ai-hype-machine/server/dist/mcp/index.js"],
      "env": {
        "MCP_PLAYER_ID": "mcp-bot",
        "MCP_PLAYER_NAME": "AI Bot",
        "DB_PATH": "/Users/yourname/ai-hype-machine/data/game.db"
      }
    }
  }
}
```
- Paths are filled dynamically from the API (`GET /api/meta` returns server paths)
- Copy button next to the snippet

**Step-by-step instructions**
1. Copy the snippet above
2. Open terminal: `code ~/.claude/settings.json` (or paste path manually)
3. Merge the `mcpServers` block into your settings file
4. Restart Claude Code
5. Ask Claude: *"Connect to the ai-hype-machine MCP and start playing"*

**What the AI can do**
List of available MCP tools in plain English:
- Read your full game state
- Click to generate tokens
- Buy hardware, models, investors
- Buy upgrades
- Prestige when ready
- Check the leaderboard

**MCP player on leaderboard**
Note: the AI plays as a separate player (`AI Bot`) — it appears on the global leaderboard and competes against human players.

---

## Implementation Notes

### New API endpoint needed
`GET /api/meta` — returns server install paths for the MCP config snippet:
```json
{
  "mcpEntrypoint": "/Users/yourname/ai-hype-machine/server/dist/mcp/index.js",
  "dbPath": "/Users/yourname/ai-hype-machine/data/game.db"
}
```

### Routing
- `/` — `landing.html` served as a static file, no React involved
- `/play` — React app (current game flow: name input → game)
- Landing page `[ play ]` button navigates to `/play`

### State
- Tooltips: CSS hover only, no state needed
- Unlock hints: derived from game state already in memory
- First-time hints: one boolean per hint key in `localStorage`
- Modal open/close: local React state
- MCP tab: fetches `/api/meta` once on mount

### What does NOT change
- Game logic — zero changes
- Visual style — same white monospace
- All existing components — extended, not replaced

---

## Out of scope for this spec

- Tutorial / guided walkthrough (click here, now click here)
- Video or animated explainer
- Social sharing buttons
- Email / notifications
- Auth / accounts
