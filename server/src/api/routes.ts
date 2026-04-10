import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
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
  doSellHardware,
  doRemoveModel,
  doMarketing,
  doPrestige,
  getOnlineCount,
  getGlobalTokensEarned,
  clearAllSessions,
} from "../game/session.js";
import {
  getLeaderboard,
  loadState,
  resetDb,
  createPlayer,
  findPlayerByNameAndPin,
} from "../db/index.js";
import { broadcastMcpAction } from "../ws/handler.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Rate limiter (PIN brute-force protection) ────────────────────────────────

interface RateLimitEntry {
  failures: number;
  windowStart: number;
}

const authAttempts = new Map<string, RateLimitEntry>();
const MAX_FAILURES = 5;
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes

function checkRateLimit(name: string): { blocked: boolean; minutesLeft?: number } {
  const key = name.toLowerCase();
  const entry = authAttempts.get(key);
  if (!entry) return { blocked: false };
  const elapsed = Date.now() - entry.windowStart;
  if (elapsed > WINDOW_MS) {
    authAttempts.delete(key);
    return { blocked: false };
  }
  if (entry.failures >= MAX_FAILURES) {
    const minutesLeft = Math.ceil((WINDOW_MS - elapsed) / 60_000);
    return { blocked: true, minutesLeft };
  }
  return { blocked: false };
}

function recordFailure(name: string): void {
  const key = name.toLowerCase();
  const entry = authAttempts.get(key);
  const now = Date.now();
  if (!entry || Date.now() - entry.windowStart > WINDOW_MS) {
    authAttempts.set(key, { failures: 1, windowStart: now });
  } else {
    entry.failures++;
  }
}

function clearFailures(name: string): void {
  authAttempts.delete(name.toLowerCase());
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function ensureSession(playerId: string) {
  const inMemory = getSession(playerId);
  if (inMemory) return inMemory;
  const fromDb = await loadState(playerId);
  if (!fromDb) return null;
  return loadOrCreateSession(playerId, fromDb.playerName);
}

function validatePin(pin: unknown): pin is string {
  return typeof pin === "string" && /^\d{4,8}$/.test(pin);
}

function validateName(name: unknown): name is string {
  return typeof name === "string" && name.trim().length >= 1 && name.trim().length <= 20;
}

export const router = Router();

// ─── Register ─────────────────────────────────────────────────────────────────

router.post("/players", async (req: Request, res: Response) => {
  const { playerName, pin } = req.body as { playerName?: string; pin?: string };

  if (!validateName(playerName)) {
    res.status(400).json({ error: "playerName must be 1–20 characters" });
    return;
  }
  if (!validatePin(pin)) {
    res.status(400).json({ error: "pin must be 4–8 digits" });
    return;
  }

  const name = playerName.trim();
  const playerId = uuidv4();
  const pinHash = await bcrypt.hash(pin, 10);

  const { nameTaken } = await createPlayer(playerId, name, pinHash);
  if (nameTaken) {
    res.status(409).json({ error: "Name already taken — choose a different one or log in." });
    return;
  }
  const state = await loadOrCreateSession(playerId, name);

  res.json({ playerId, state, nameTaken: false });
});

// ─── Login / recovery ─────────────────────────────────────────────────────────

router.post("/auth", async (req: Request, res: Response) => {
  const { playerName, pin } = req.body as { playerName?: string; pin?: string };

  if (!validateName(playerName) || !validatePin(pin)) {
    res.status(400).json({ error: "playerName and pin (4–8 digits) are required" });
    return;
  }

  const name = playerName.trim();

  const limit = checkRateLimit(name);
  if (limit.blocked) {
    res.status(429).json({ error: `Too many failed attempts. Try again in ${limit.minutesLeft} minutes.` });
    return;
  }

  const playerId = await findPlayerByNameAndPin(
    name,
    "", // unused — comparePin handles hashing
    bcrypt.compare,
    pin
  );

  if (!playerId) {
    recordFailure(name);
    res.status(401).json({ error: "Wrong name or PIN" });
    return;
  }

  clearFailures(name);
  const state = await loadOrCreateSession(playerId, name);
  res.json({ playerId, state });
});

// ─── Get state ────────────────────────────────────────────────────────────────

router.get("/state/:playerId", async (req: Request, res: Response) => {
  const { playerId } = req.params;
  const state = await ensureSession(playerId);
  if (!state) {
    res.status(404).json({ error: "Player not found" });
    return;
  }
  res.json(state);
});

// ─── Click ────────────────────────────────────────────────────────────────────

router.post("/click/:playerId", async (req: Request, res: Response) => {
  const { playerId } = req.params;
  if (!await ensureSession(playerId)) { res.status(404).json({ error: "Player not found" }); return; }
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

router.post("/buy/:playerId", async (req: Request, res: Response) => {
  const { playerId } = req.params;
  if (!await ensureSession(playerId)) { res.status(404).json({ error: "Player not found" }); return; }
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

// ─── Sell / remove ────────────────────────────────────────────────────────────

router.post("/sell/:playerId", async (req: Request, res: Response) => {
  const { playerId } = req.params;
  if (!await ensureSession(playerId)) { res.status(404).json({ error: "Player not found" }); return; }
  const { producerType, id, quantity } = req.body as {
    producerType?: string;
    id?: string;
    quantity?: number;
  };
  const qty = Math.max(1, Number(quantity) || 1);

  let result;
  if (producerType === "hardware") {
    result = doSellHardware(playerId, id as HardwareId, qty);
  } else if (producerType === "model") {
    result = doRemoveModel(playerId, id as ModelId, qty);
  } else {
    res.status(400).json({ error: "Can only sell hardware or model" });
    return;
  }

  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json(result.state);
});

// ─── Marketing spend ──────────────────────────────────────────────────────────

router.post("/marketing/:playerId", async (req: Request, res: Response) => {
  const { playerId } = req.params;
  if (!await ensureSession(playerId)) { res.status(404).json({ error: "Player not found" }); return; }
  const result = doMarketing(playerId);
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  if (req.headers["x-mcp-source"]) broadcastMcpAction(playerId, "marketing");
  res.json(result.state);
});

// ─── Prestige ─────────────────────────────────────────────────────────────────

router.post("/prestige/:playerId", async (req: Request, res: Response) => {
  const { playerId } = req.params;
  if (!await ensureSession(playerId)) { res.status(404).json({ error: "Player not found" }); return; }
  const result = doPrestige(playerId);
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  if (req.headers["x-mcp-source"]) broadcastMcpAction(playerId, "prestige");
  res.json(result.state);
});

// ─── Available actions ────────────────────────────────────────────────────────

router.get("/actions/:playerId", async (req: Request, res: Response) => {
  const { playerId } = req.params;
  const state = await ensureSession(playerId);
  if (!state) {
    res.status(404).json({ error: "Player not found" });
    return;
  }
  res.json(getAvailableActions(state));
});

// ─── Leaderboard ──────────────────────────────────────────────────────────────

router.get("/leaderboard", async (_req: Request, res: Response) => {
  res.json(await getLeaderboard());
});

// ─── Stats (for landing page) ─────────────────────────────────────────────────

router.get("/stats", async (_req: Request, res: Response) => {
  res.json({
    playersOnline: getOnlineCount(),
    globalTokensEarned: getGlobalTokensEarned(),
    topPlayers: await getLeaderboard(5),
  });
});

// ─── Admin reset ──────────────────────────────────────────────────────────────

router.post("/admin/reset", async (req: Request, res: Response) => {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || req.headers["x-admin-secret"] !== secret) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  clearAllSessions();
  await resetDb();
  res.json({ ok: true, message: "DB wiped and sessions cleared" });
});

// ─── Meta (for MCP config tab) ────────────────────────────────────────────────

router.get("/meta", (_req: Request, res: Response) => {
  const serverRoot = path.resolve(__dirname, "../../..");
  res.json({
    mcpEntrypoint: path.join(serverRoot, "server/dist/mcp/index.js"),
    playersOnline: getOnlineCount(),
    globalTokensEarned: getGlobalTokensEarned(),
  });
});
