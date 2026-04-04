## http://tikkensgame.com

# T'kkens Game (inspired by kittensgame.com) 

Feed your token burning addiction. Incremental idle game. Generate tokens, buy GPUs, run AI models, attract investors, achieve AGI. Or connect Claude via MCP and let it play for you to dominate the leaderboard.

---

## Build it locally. Fresh mac — one command

Open **Terminal** and paste:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/kamilgpuk/tikkensgame/main/bootstrap.sh)"
```

This installs everything from scratch (Xcode CLT → Homebrew → Node → cloudflared → clone → start) and launches the game with a public Cloudflare URL. Takes ~5 minutes on a clean machine.

---

## Already have the repo

```bash
./start.sh --tunnel    # build + start + public Cloudflare URL
./start.sh             # build + start locally only
./start.sh --dev       # dev mode, hot reload (server :3000, client :5173)
```

---

## Ports

| Service | Port |
|---|---|
| Game server + API | 3000 |
| Vite dev server | 5173 (dev only) |
| MCP server | stdio (separate process) |

---

## Let Claude play via MCP

### Play on tikkensgame.com

Add this to your `.mcp.json` (or `~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "ai-hype-machine": {
      "command": "node",
      "args": ["/path/to/tikkensgame/server/dist/mcp/index.js"],
      "env": {
        "MCP_PLAYER_ID": "your-player-uuid",
        "MCP_PLAYER_NAME": "your-name",
        "API_URL": "https://www.tikkensgame.com/api"
      }
    }
  }
}
```

The MCP server auto-registers your player on first connect if the ID doesn't exist yet.

### Play locally

```json
{
  "mcpServers": {
    "ai-hype-machine": {
      "command": "node",
      "args": ["/path/to/tikkensgame/server/dist/mcp/index.js"],
      "env": {
        "MCP_PLAYER_ID": "your-player-uuid",
        "MCP_PLAYER_NAME": "your-name"
      }
    }
  }
}
```

Then in Claude Code, Claude can call tools like `get_game_state`, `buy_producer`, `click_n`, etc.

---

## Tech stack

- **Frontend** — React + Vite, white monospace CSS
- **Backend** — Node.js + Express + WebSockets
- **DB** — SQLite (file at `data/game.db`)
- **MCP** — `@modelcontextprotocol/sdk`, stdio transport

## Dev

```bash
npm test                          # run all tests
npm run test --workspace=server   # server unit tests only (32 tests)
```
