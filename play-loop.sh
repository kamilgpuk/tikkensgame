#!/usr/bin/env bash
# T'kkens auto-player: one optimal move every 5 seconds
# Usage: ./play-loop.sh

PLAYER_ID="bd97b096-d8bb-4375-9a96-6e25ff4e22bb"
API="https://www.tikkensgame.com/api"

log() { echo "[$(date '+%H:%M:%S')] $*"; }

make_best_move() {
  # Get state + available actions in parallel
  STATE=$(curl -s "$API/state/$PLAYER_ID")
  ACTIONS=$(curl -s "$API/actions/$PLAYER_ID")

  TOKENS=$(echo "$STATE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(float(d['tokens']))")
  TPS=$(echo "$STATE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(float(d['tokensPerSecond']))")

  # Find the best affordable action (highest tokensPerSecGain, then unlocksNew, else click)
  BEST=$(echo "$ACTIONS" | python3 -c "
import sys, json
actions = json.load(sys.stdin)
affordable = [a for a in actions if a.get('affordable')]
# Prefer items that unlock new things (first purchase), then highest tps gain
affordable.sort(key=lambda a: (
  -a.get('tokensPerSecGain', 0) if a.get('tokensPerSecGain', 0) > 0
  else (1 if a.get('unlocksNew') else 2)
))
if affordable:
  a = affordable[0]
  print(a['type'], a['id'], a['name'], a['cost'], a['currency'])
else:
  print('click')
")

  TYPE=$(echo "$BEST" | awk '{print $1}')
  ID=$(echo "$BEST" | awk '{print $2}')
  NAME=$(echo "$BEST" | cut -d' ' -f3-)

  if [[ "$TYPE" == "click" ]]; then
    RESULT=$(curl -s -X POST "$API/click/$PLAYER_ID" \
      -H "Content-Type: application/json" \
      -H "X-Mcp-Source: 1" \
      -d '{"n":1}')
    NEW_TOKENS=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(round(float(d['tokens']),2))")
    log "CLICK → tokens: $NEW_TOKENS (tps: $TPS)"
  else
    RESULT=$(curl -s -X POST "$API/buy/$PLAYER_ID" \
      -H "Content-Type: application/json" \
      -H "X-Mcp-Source: 1" \
      -d "{\"producerType\":\"$TYPE\",\"id\":\"$ID\",\"quantity\":1}")
    if echo "$RESULT" | python3 -c "import sys,json; json.load(sys.stdin)" 2>/dev/null; then
      NEW_TOKENS=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(round(float(d['tokens']),2))" 2>/dev/null || echo "?")
      log "BUY $NAME → tokens: $NEW_TOKENS (tps: $TPS)"
    else
      log "BUY $NAME failed: $RESULT — falling back to click"
      curl -s -X POST "$API/click/$PLAYER_ID" \
        -H "Content-Type: application/json" \
        -H "X-Mcp-Source: 1" \
        -d '{"n":1}' > /dev/null
    fi
  fi
}

log "Starting T'kkens auto-player for player: $PLAYER_ID"
log "Press Ctrl+C to stop"
echo ""

while true; do
  make_best_move
  sleep 5
done
