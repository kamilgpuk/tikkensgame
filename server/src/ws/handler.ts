import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";
import type { Server } from "http";
import type { GameState, MilestoneId, ServerMessage } from "@ai-hype/shared";
import { MILESTONE_MAP, serializeState } from "@ai-hype/shared";
import { loadOrCreateSession, releaseSession, setTickCallback, setMilestoneCallback } from "../game/session.js";
import { getLeaderboard } from "../db/index.js";
import { isShutdown } from "../shutdown.js";

// Map from playerId → Set of WebSocket connections
const playerSockets = new Map<string, Set<WebSocket>>();

function send(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    // Serialize GameState Decimal fields to strings before JSON transport
    const wireMsg = msg.type === "state"
      ? { ...msg, payload: serializeState(msg.payload) }
      : msg;
    ws.send(JSON.stringify(wireMsg));
  }
}

function broadcast(playerId: string, msg: ServerMessage): void {
  const sockets = playerSockets.get(playerId);
  if (!sockets) return;
  for (const ws of sockets) send(ws, msg);
}

export function broadcastMcpAction(playerId: string, action: string): void {
  broadcast(playerId, { type: "mcp_action", payload: { action } });
}

export function setupWebSocket(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url ?? "", `http://localhost`);
    const playerId = url.searchParams.get("playerId");
    const playerName = url.searchParams.get("playerName") ?? "Unknown";

    if (!playerId) {
      ws.close(1008, "playerId required");
      return;
    }

    if (isShutdown()) {
      ws.close(1001, "Game has shut down. Thanks for playing.");
      return;
    }

    if (!playerSockets.has(playerId)) playerSockets.set(playerId, new Set());
    playerSockets.get(playerId)!.add(ws);

    // Load/create session and push initial state + leaderboard
    loadOrCreateSession(playerId, playerName).then((state) => {
      send(ws, { type: "state", payload: state });
    }).catch(() => null);

    getLeaderboard(20).then((lb) => {
      send(ws, { type: "leaderboard", payload: lb });
    }).catch(() => null);

    ws.on("close", () => {
      playerSockets.get(playerId)?.delete(ws);
      if (playerSockets.get(playerId)?.size === 0) {
        playerSockets.delete(playerId);
        releaseSession(playerId).catch(() => null); // save + evict from memory
      }
    });

    ws.on("error", () => {
      playerSockets.get(playerId)?.delete(ws);
    });
  });

  // Hook into tick loop — push state updates to relevant players
  setTickCallback((playerId: string, state: GameState) => {
    broadcast(playerId, { type: "state", payload: state });
  });

  // Hook into milestone events
  setMilestoneCallback((playerId: string, milestoneId: MilestoneId) => {
    const def = MILESTONE_MAP[milestoneId];
    broadcast(playerId, {
      type: "milestone",
      payload: { id: milestoneId, message: def.message, hypeGain: def.hypeGain },
    });
    // Push updated leaderboard to everyone on milestone
    getLeaderboard(20).then((leaderboard) => {
      for (const [pid] of playerSockets) {
        broadcast(pid, { type: "leaderboard", payload: leaderboard });
      }
    }).catch(() => null);
  });

  return wss;
}
