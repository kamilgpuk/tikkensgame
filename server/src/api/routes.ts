import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import { fileURLToPath } from "url";
import type { HardwareId, ModelId, InvestorId, UpgradeId } from "@ai-hype/shared";
import { getAvailableActions } from "../game/engine.js";
import {
  loadOrCreateSession,
  getSession,
  doClick,
  doBuyHardware,
  doBuyModel,
  doBuyInvestor,
  doBuyUpgrade,
  doPrestige,
  getOnlineCount,
  getGlobalTokensEarned,
} from "../game/session.js";
import { getLeaderboard, loadState } from "../db/index.js";
import { broadcastMcpAction } from "../ws/handler.js";

// Ensures a session is in memory — loads from DB if needed (e.g. MCP calls before WS connect)
function ensureSession(playerId: string) {
  const inMemory = getSession(playerId);
  if (inMemory) return inMemory;
  const fromDb = loadState(playerId);
  if (!fromDb) return null;
  return loadOrCreateSession(playerId, fromDb.playerName);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const router = Router();

// ─── Player init ──────────────────────────────────────────────────────────────

router.post("/players", (req: Request, res: Response) => {
  const { playerName, playerId: requestedId } = req.body as { playerName?: string; playerId?: string };
  if (!playerName || typeof playerName !== "string" || playerName.trim().length === 0) {
    res.status(400).json({ error: "playerName required" });
    return;
  }
  const playerId = (typeof requestedId === "string" && requestedId.trim().length > 0)
    ? requestedId.trim()
    : uuidv4();
  const state = loadOrCreateSession(playerId, playerName.trim().slice(0, 32));
  res.json({ playerId, state });
});

// ─── Get state ────────────────────────────────────────────────────────────────

router.get("/state/:playerId", (req: Request, res: Response) => {
  const { playerId } = req.params;
  const state = ensureSession(playerId);
  if (!state) {
    res.status(404).json({ error: "Player not found" });
    return;
  }
  res.json(state);
});

// ─── Click ────────────────────────────────────────────────────────────────────

router.post("/click/:playerId", (req: Request, res: Response) => {
  const { playerId } = req.params;
  if (!ensureSession(playerId)) { res.status(404).json({ error: "Player not found" }); return; }
  const n = Math.min(1000, Math.max(1, Number((req.body as { n?: number }).n) || 1));
  const result = doClick(playerId, n);
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  if (req.headers["x-mcp-source"]) broadcastMcpAction(playerId, "click");
  res.json(result.state);
});

// ─── Buy ──────────────────────────────────────────────────────────────────────

router.post("/buy/:playerId", (req: Request, res: Response) => {
  const { playerId } = req.params;
  if (!ensureSession(playerId)) { res.status(404).json({ error: "Player not found" }); return; }
  const { producerType, id, quantity } = req.body as {
    producerType?: string;
    id?: string;
    quantity?: number;
  };
  const qty = Math.max(1, Number(quantity) || 1);

  let result;
  if (producerType === "hardware") {
    result = doBuyHardware(playerId, id as HardwareId, qty);
  } else if (producerType === "model") {
    result = doBuyModel(playerId, id as ModelId, qty);
  } else if (producerType === "investor") {
    result = doBuyInvestor(playerId, id as InvestorId, qty);
  } else if (producerType === "upgrade") {
    result = doBuyUpgrade(playerId, id as UpgradeId);
  } else {
    res.status(400).json({ error: "Invalid producerType" });
    return;
  }

  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  if (req.headers["x-mcp-source"]) broadcastMcpAction(playerId, `buy:${id}`);
  res.json(result.state);
});

// ─── Prestige ─────────────────────────────────────────────────────────────────

router.post("/prestige/:playerId", (req: Request, res: Response) => {
  const { playerId } = req.params;
  if (!ensureSession(playerId)) { res.status(404).json({ error: "Player not found" }); return; }
  const result = doPrestige(playerId);
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  if (req.headers["x-mcp-source"]) broadcastMcpAction(playerId, "prestige");
  res.json(result.state);
});

// ─── Available actions ────────────────────────────────────────────────────────

router.get("/actions/:playerId", (req: Request, res: Response) => {
  const { playerId } = req.params;
  const state = ensureSession(playerId);
  if (!state) {
    res.status(404).json({ error: "Player not found" });
    return;
  }
  res.json(getAvailableActions(state));
});

// ─── Leaderboard ──────────────────────────────────────────────────────────────

router.get("/leaderboard", (_req: Request, res: Response) => {
  res.json(getLeaderboard(20));
});

// ─── Stats (for landing page) ─────────────────────────────────────────────────

router.get("/stats", (_req: Request, res: Response) => {
  res.json({
    playersOnline: getOnlineCount(),
    globalTokensEarned: getGlobalTokensEarned(),
    topPlayers: getLeaderboard(5),
  });
});

// ─── Meta (for MCP config tab) ────────────────────────────────────────────────

router.get("/meta", (_req: Request, res: Response) => {
  const serverRoot = path.resolve(__dirname, "../../..");
  res.json({
    mcpEntrypoint: path.join(serverRoot, "server/dist/mcp/index.js"),
    dbPath: path.join(serverRoot, "data/game.db"),
    playersOnline: getOnlineCount(),
    globalTokensEarned: getGlobalTokensEarned(),
  });
});
