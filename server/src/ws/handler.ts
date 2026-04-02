import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";
import type { Server } from "http";
import type { GameState, MilestoneId, ServerMessage } from "@ai-hype/shared";
import { MILESTONE_MAP } from "@ai-hype/shared";
import { loadOrCreateSession, setTickCallback, setMilestoneCallback } from "../game/session.js";
import { getLeaderboard } from "../db/index.js";

// Map from playerId → Set of WebSocket connections
const playerSockets = new Map<string, Set<WebSocket>>();

function send(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
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
    // Extract playerId from query string: /ws?playerId=xxx&playerName=yyy
    const url = new URL(req.url ?? "", `http://localhost`);
    const playerId = url.searchParams.get("playerId");
    const playerName = url.searchParams.get("playerName") ?? "Unknown";

    if (!playerId) {
      ws.close(1008, "playerId required");
      return;
    }

    // Register socket
    if (!playerSockets.has(playerId)) playerSockets.set(playerId, new Set());
    playerSockets.get(playerId)!.add(ws);

    // Load/create session and push initial state
    const state = loadOrCreateSession(playerId, playerName);
    send(ws, { type: "state", payload: state });

    // Send initial leaderboard
    send(ws, { type: "leaderboard", payload: getLeaderboard(20) });

    ws.on("close", () => {
      playerSockets.get(playerId)?.delete(ws);
      if (playerSockets.get(playerId)?.size === 0) {
        playerSockets.delete(playerId);
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
    // Also push updated leaderboard to everyone when a milestone fires
    const leaderboard = getLeaderboard(20);
    for (const [pid] of playerSockets) {
      broadcast(pid, { type: "leaderboard", payload: leaderboard });
    }
  });

  return wss;
}
