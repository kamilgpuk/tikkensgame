#!/usr/bin/env bash
# ── AI Hype Machine — bootstrap ───────────────────────────────────────────────
# Paste this into Terminal on a fresh Mac:
#
#   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/kamilgpuk/tikkensgame/main/bootstrap.sh)"
#
# What this does:
#   1. Installs Xcode Command Line Tools (git, make, etc.)
#   2. Installs Homebrew
#   3. Installs Node.js + cloudflared via Homebrew
#   4. Clones this repo
#   5. Installs npm dependencies
#   6. Starts the game with a Cloudflare tunnel

set -e

REPO="https://github.com/kamilgpuk/tikkensgame.git"
INSTALL_DIR="$HOME/ai-hype-machine"

# ── Colours ───────────────────────────────────────────────────────────────────

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BOLD='\033[1m'; NC='\033[0m'
info()  { echo -e "${GREEN}▶${NC} $1"; }
warn()  { echo -e "${YELLOW}⚠${NC}  $1"; }
error() { echo -e "${RED}✗${NC}  $1"; exit 1; }
step()  { echo -e "\n${BOLD}── $1 ──${NC}"; }

echo -e "${BOLD}"
echo "  ╔═══════════════════════════════════╗"
echo "  ║     AI HYPE MACHINE — SETUP       ║"
echo "  ╚═══════════════════════════════════╝"
echo -e "${NC}"

# ── Step 1: Xcode Command Line Tools ─────────────────────────────────────────

step "Xcode Command Line Tools"
if xcode-select -p &>/dev/null; then
  info "Already installed."
else
  info "Installing Xcode Command Line Tools..."
  info "A dialog box will appear — click Install and wait for it to finish."
  xcode-select --install 2>/dev/null || true
  echo -n "   Waiting for installation to complete"
  until xcode-select -p &>/dev/null; do
    echo -n "."
    sleep 5
  done
  echo ""
  info "Done."
fi

# ── Step 2: Homebrew ──────────────────────────────────────────────────────────

step "Homebrew"
if command -v brew &>/dev/null; then
  info "Already installed."
else
  info "Installing Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

  # Add brew to PATH for Apple Silicon
  if [[ -f "/opt/homebrew/bin/brew" ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
    echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> "$HOME/.zprofile"
  fi
fi

# ── Step 3: Node.js ───────────────────────────────────────────────────────────

step "Node.js"
if command -v node &>/dev/null; then
  NODE_VER=$(node --version)
  info "Already installed: $NODE_VER"
else
  info "Installing Node.js..."
  brew install node
fi

# ── Step 4: cloudflared ───────────────────────────────────────────────────────

step "cloudflared"
if command -v cloudflared &>/dev/null; then
  info "Already installed."
else
  info "Installing cloudflared..."
  brew install cloudflared
fi

# ── Step 5: Clone repo ────────────────────────────────────────────────────────

step "Cloning repo"
if [[ -d "$INSTALL_DIR" ]]; then
  info "Repo already exists at $INSTALL_DIR — pulling latest..."
  git -C "$INSTALL_DIR" pull
else
  info "Cloning into $INSTALL_DIR..."
  git clone "$REPO" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"

# ── Step 6: npm install ───────────────────────────────────────────────────────

step "Installing npm dependencies"
npm install --workspaces --include-workspace-root --silent
info "Done."

# ── Step 7: Cloudflare login (one-time) ───────────────────────────────────────

step "Cloudflare login"
if [[ -f "$HOME/.cloudflared/cert.pem" ]]; then
  info "Already logged in."
else
  warn "You need to log in to Cloudflare once."
  warn "A browser window will open — log in or create a free account."
  echo ""
  read -p "   Press Enter to open the browser for Cloudflare login..."
  cloudflared tunnel login
fi

# ── Done ──────────────────────────────────────────────────────────────────────

echo ""
echo -e "${GREEN}${BOLD}"
echo "  ✓ Setup complete!"
echo -e "${NC}"
echo -e "  To start the game:"
echo -e "    ${BOLD}cd $INSTALL_DIR && ./start.sh --tunnel${NC}"
echo ""
echo -e "  Or start right now? (Ctrl+C to skip)"
read -t 5 -p "  Starting in 5 seconds... " || true
echo ""

cd "$INSTALL_DIR"
exec ./start.sh --tunnel
