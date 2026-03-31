#!/usr/bin/env bash
set -e

# ── AI Hype Machine — start script ───────────────────────────────────────────
# Usage:
#   ./start.sh          — build + start server (no tunnel)
#   ./start.sh --tunnel — build + start server + cloudflare tunnel
#   ./start.sh --dev    — dev mode (no build, hot reload)

TUNNEL=false
DEV=false
PORT=${PORT:-3000}

for arg in "$@"; do
  case $arg in
    --tunnel) TUNNEL=true ;;
    --dev)    DEV=true ;;
  esac
done

# Colours
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()    { echo -e "${GREEN}▶${NC} $1"; }
warn()    { echo -e "${YELLOW}⚠${NC}  $1"; }
error()   { echo -e "${RED}✗${NC}  $1"; exit 1; }

# ── Checks ────────────────────────────────────────────────────────────────────

command -v node >/dev/null 2>&1 || error "node not found. Install from https://nodejs.org"
command -v npm  >/dev/null 2>&1 || error "npm not found."

if $TUNNEL; then
  command -v cloudflared >/dev/null 2>&1 || {
    warn "cloudflared not found. Install with: brew install cloudflared"
    warn "Running without tunnel."
    TUNNEL=false
  }
fi

# ── Setup ─────────────────────────────────────────────────────────────────────

mkdir -p data

# Install deps if node_modules missing
if [ ! -d "node_modules" ]; then
  info "Installing dependencies..."
  npm install --workspaces --include-workspace-root --silent
fi

# ── PIDs for cleanup ──────────────────────────────────────────────────────────

PIDS=()

cleanup() {
  echo ""
  info "Shutting down..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null
  info "Done."
}
trap cleanup EXIT INT TERM

# ── Dev mode ──────────────────────────────────────────────────────────────────

if $DEV; then
  info "Starting in dev mode (hot reload)..."
  info "Server → http://localhost:$PORT"
  info "Client → http://localhost:5173 (Vite)"
  echo ""

  PORT=$PORT npx tsx watch server/src/index.ts &
  PIDS+=($!)

  sleep 1  # let server start before Vite

  (cd client && npx vite --port 5173) &
  PIDS+=($!)

  wait
  exit 0
fi

# ── Production build ──────────────────────────────────────────────────────────

info "Building..."
npm run build --workspaces --if-present --silent
info "Build complete."

# ── Start server ──────────────────────────────────────────────────────────────

info "Starting server on port $PORT..."
PORT=$PORT node server/dist/index.js &
SERVER_PID=$!
PIDS+=($SERVER_PID)

# Wait for server to be ready (max 10s)
for i in $(seq 1 20); do
  if curl -sf "http://localhost:$PORT/api/leaderboard" >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

# ── Cloudflare tunnel ─────────────────────────────────────────────────────────

if $TUNNEL; then
  info "Starting Cloudflare tunnel..."
  # Capture the tunnel URL from cloudflared output
  TUNNEL_LOG=$(mktemp)
  cloudflared tunnel --url "http://localhost:$PORT" 2>&1 | tee "$TUNNEL_LOG" &
  PIDS+=($!)

  # Wait for the URL to appear in logs
  for i in $(seq 1 30); do
    URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$TUNNEL_LOG" 2>/dev/null | head -1)
    if [ -n "$URL" ]; then break; fi
    sleep 1
  done

  echo ""
  echo -e "  ${GREEN}╔══════════════════════════════════════════════╗${NC}"
  if [ -n "$URL" ]; then
  echo -e "  ${GREEN}║  Public URL: $URL${NC}"
  else
  echo -e "  ${GREEN}║  Public URL: (check cloudflared output above)${NC}"
  fi
  echo -e "  ${GREEN}║  Local URL:  http://localhost:$PORT${NC}"
  echo -e "  ${GREEN}╚══════════════════════════════════════════════╝${NC}"
  echo ""
else
  echo ""
  echo -e "  ${GREEN}╔══════════════════════════════════════════╗${NC}"
  echo -e "  ${GREEN}║  Local:   http://localhost:$PORT${NC}"
  echo -e "  ${GREEN}║  Network: http://$(ipconfig getifaddr en0 2>/dev/null || hostname -I | awk '{print $1}'):$PORT${NC}"
  echo -e "  ${GREEN}╚══════════════════════════════════════════╝${NC}"
  echo ""
  warn "Others can't reach you yet. Run with --tunnel for a public URL."
  warn "Or forward port $PORT on your router."
fi

info "Press Ctrl+C to stop."
echo ""

wait
