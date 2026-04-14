# Tikkensgame — Claude Code Session Guide

**Live:** https://tikkensgame.com  
**Repo:** https://github.com/kamilgpuk/tikkensgame  
**Deploy:** Railway (auto-deploys on push to `main`)

---

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 + Vite → TypeScript |
| Backend | Node.js + Express + WebSockets |
| Database | Supabase (PostgreSQL) |
| Monorepo | npm workspaces (client / server / shared) |
| Deploy | Railway + nixpacks (no Dockerfile) |

---

## Deployment Topology

**Build command:** `npm run build`  
**Start command:** `node server/dist/index.js`  
**Port:** `process.env.PORT` or 3000

### Build output layout

```
server/dist/
├── index.js              ← server entry point
├── landing.html          ← served at GET /
├── public/               ← React SPA, served at /play/
│   ├── index.html
│   └── assets/           ← Vite-hashed JS/CSS chunks
├── api/                  ← compiled routes
├── game/                 ← compiled engine + session store
├── db/                   ← compiled Supabase client
├── mcp/                  ← MCP server (separate process)
└── ws/                   ← WebSocket handler
```

---

## ⚠️ Critical File Path Traps

### Landing page — ALWAYS edit in server/src/
| Location | Deployed? | Purpose |
|----------|-----------|---------|
| `/landing.html` (repo root) | **NO** | git-ignored stub |
| `server/src/landing.html` | **YES** | source — edit this |
| `server/dist/landing.html` | **YES** | build output — auto-generated |

→ **Never touch the root `landing.html`. Always edit `server/src/landing.html`, then rebuild.**

### Client build output
- Vite outputs to `server/dist/public/` — **not** `client/dist/`
- Express serves the SPA from `server/dist/public/`
- JS/CSS chunks are Vite-hashed (cache-busting is automatic)

---

## Environment Variables

**Required — server fails to start without these:**
```
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
```

**Optional:**
```
PORT=3000                    # default: 3000
ADMIN_SECRET=                # for /api/admin/* endpoints
MCP_PLAYER_NAME=             # MCP process only
MCP_PLAYER_PIN=              # MCP process only
API_URL=                     # MCP process only (default: http://localhost:PORT/api)
```

Set in Railway dashboard → Project → Variables. Never commit `.env`.

---

## Test Commands

```bash
npm test                  # all tests
npm run test:engine       # game engine (biggest suite — 1060 lines)
npm run test:api          # API routes
npm run test:session      # session store
npm run test:ws           # WebSocket handler
npm run test:db           # DB integration
```

Server tests use Jest + ts-jest (ESM mode). Client tests use Vitest.

---

## Common Gotchas

**Circuit breaker:** After 4 consecutive Supabase failures, server stops retrying for up to 60s. Backoff: `[0, 5s, 15s, 60s]`. Check logs for "Supabase" errors before assuming the server is broken.

**MCP is a separate process:** `npm start` does NOT start the MCP server. Run it separately:
```bash
node server/dist/mcp/index.js
```
With env vars `MCP_PLAYER_NAME`, `MCP_PLAYER_PIN`, `API_URL`.

**No DB migrations:** Supabase schema must be set up manually. No migration tooling.

**Session eviction on WS disconnect:** When a WebSocket closes, the in-memory session is evicted. State is persisted to Supabase every 2s, so no data is lost — but the next request triggers a fresh load from DB.

**Auto-sync commits:** Commits tagged `[skip deploy]` are data syncs and do NOT trigger Railway deploys.

---

## Local Dev

```bash
./start.sh --dev          # hot reload (server :3000, Vite :5173)
./start.sh                # build + start (server :3000 only)
./start.sh --tunnel       # build + start + Cloudflare tunnel
```

---

## Deployment Verification After Push

After pushing to `main`:
1. Check Railway dashboard for build status
2. Wait ~60s for rolling deploy
3. Curl the landing page: `curl -I https://tikkensgame.com`
4. If changes aren't visible: check for stale files or rolling deploy cache (wait another 30s)

Do not report success until the production URL reflects the change.
