/**
 * In-memory game session store.
 * Each player has one live GameState in memory, ticked on a server interval.
 * States are persisted to Supabase periodically and on mutations.
 */
import { GameState, MilestoneId } from "@ai-hype/shared";
import {
  createInitialState,
  tick,
  click as engineClick,
  buyHardware,
  buyModel,
  buyInvestor,
  buyUpgrade,
  sellHardware,
  removeModel,
  prestige as enginePrestige,
  spendOnMarketing,
  BuyResult,
} from "./engine.js";
import { saveState, loadState } from "../db/index.js";
import type { HardwareId, ModelId, InvestorId, UpgradeId } from "@ai-hype/shared";

type MilestoneCallback = (playerId: string, milestone: MilestoneId) => void;

const sessions = new Map<string, GameState>();
const lastSaved = new Map<string, number>();
const dirty = new Set<string>();
const SAVE_INTERVAL_MS = 2_000;
const FLUSH_INTERVAL_MS = 10_000;
const TICK_INTERVAL_MS = 100;

let onMilestone: MilestoneCallback | null = null;

export function setMilestoneCallback(cb: MilestoneCallback): void {
  onMilestone = cb;
}

export function getSession(playerId: string): GameState | null {
  return sessions.get(playerId) ?? null;
}

export function setSession(state: GameState): void {
  sessions.set(state.playerId, state);
}

export async function loadOrCreateSession(playerId: string, playerName: string): Promise<GameState> {
  const existing = sessions.get(playerId);
  if (existing) return existing;

  const fromDb = await loadState(playerId);
  if (fromDb && fromDb.totalTokensEarned !== undefined) {
    // Valid game state (not a stub row from registration)
    fromDb.updatedAt = Date.now();
    sessions.set(playerId, fromDb);
    return fromDb;
  }

  const fresh = createInitialState(playerId, playerName);
  sessions.set(playerId, fresh);
  persistSession(playerId, fresh);
  return fresh;
}

export function doClick(playerId: string, n = 1): BuyResult {
  const state = sessions.get(playerId);
  if (!state) return { ok: false, error: "Session not found" };
  const newState = engineClick(state, n);
  sessions.set(playerId, newState);
  maybeSave(playerId, newState);
  return { ok: true, state: newState };
}

export function doBuyHardware(playerId: string, id: HardwareId, qty = 1): BuyResult {
  const state = sessions.get(playerId);
  if (!state) return { ok: false, error: "Session not found" };
  const result = buyHardware(state, id, qty);
  if (result.ok) {
    sessions.set(playerId, result.state);
    maybeSave(playerId, result.state);
  }
  return result;
}

export function doBuyModel(playerId: string, id: ModelId, qty = 1): BuyResult {
  const state = sessions.get(playerId);
  if (!state) return { ok: false, error: "Session not found" };
  const result = buyModel(state, id, qty);
  if (result.ok) {
    sessions.set(playerId, result.state);
    maybeSave(playerId, result.state);
  }
  return result;
}

export function doBuyInvestor(playerId: string, id: InvestorId, qty = 1): BuyResult {
  const state = sessions.get(playerId);
  if (!state) return { ok: false, error: "Session not found" };
  const result = buyInvestor(state, id, qty);
  if (result.ok) {
    sessions.set(playerId, result.state);
    maybeSave(playerId, result.state);
  }
  return result;
}

export function doBuyUpgrade(playerId: string, id: UpgradeId): BuyResult {
  const state = sessions.get(playerId);
  if (!state) return { ok: false, error: "Session not found" };
  const result = buyUpgrade(state, id);
  if (result.ok) {
    sessions.set(playerId, result.state);
    maybeSave(playerId, result.state);
  }
  return result;
}

export function doSellHardware(playerId: string, id: HardwareId, qty = 1): BuyResult {
  const state = sessions.get(playerId);
  if (!state) return { ok: false, error: "Session not found" };
  const result = sellHardware(state, id, qty);
  if (result.ok) {
    sessions.set(playerId, result.state);
    maybeSave(playerId, result.state);
  }
  return result;
}

export function doRemoveModel(playerId: string, id: ModelId, qty = 1): BuyResult {
  const state = sessions.get(playerId);
  if (!state) return { ok: false, error: "Session not found" };
  const result = removeModel(state, id, qty);
  if (result.ok) {
    sessions.set(playerId, result.state);
    maybeSave(playerId, result.state);
  }
  return result;
}

export function doMarketing(playerId: string): BuyResult {
  const state = sessions.get(playerId);
  if (!state) return { ok: false, error: "Session not found" };
  const result = spendOnMarketing(state);
  if (result.ok) {
    sessions.set(playerId, result.state);
    maybeSave(playerId, result.state);
  }
  return result;
}

export function doPrestige(playerId: string): BuyResult {
  const state = sessions.get(playerId);
  if (!state) return { ok: false, error: "Session not found" };
  const result = enginePrestige(state);
  if (result.ok) {
    sessions.set(playerId, result.state);
    persistSession(playerId, result.state);
  }
  return result;
}

async function persistSession(playerId: string, state: GameState): Promise<void> {
  try {
    await saveState(state);
    lastSaved.set(playerId, Date.now());
    dirty.delete(playerId);
  } catch (e) {
    console.error(`[persist] SAVE FAILED for player ${playerId}:`, e);
    // Leave in dirty set — will retry on next flush
  }
}

function maybeSave(playerId: string, state: GameState): void {
  dirty.add(playerId);
  const now = Date.now();
  const last = lastSaved.get(playerId) ?? 0;
  if (now - last >= SAVE_INTERVAL_MS) {
    persistSession(playerId, state);
  }
}

// Force-flush all dirty sessions every 10s, regardless of activity
setInterval(() => {
  for (const playerId of dirty) {
    const state = sessions.get(playerId);
    if (state) persistSession(playerId, state);
  }
}, FLUSH_INTERVAL_MS);

// ─── Global tick loop ─────────────────────────────────────────────────────────

let tickInterval: ReturnType<typeof setInterval> | null = null;
type StateCallback = (playerId: string, state: GameState, newMilestones: MilestoneId[]) => void;
let onTick: StateCallback | null = null;

export function setTickCallback(cb: StateCallback): void {
  onTick = cb;
}

export function startTickLoop(): void {
  if (tickInterval) return;
  let lastTick = Date.now();
  let tickCount = 0;
  tickInterval = setInterval(() => {
    const now = Date.now();
    const elapsedMs = now - lastTick;
    lastTick = now;
    tickCount++;
    const updateDisplayRates = tickCount % 5 === 0;

    for (const [playerId, state] of sessions) {
      const { state: newState, newMilestones } = tick(state, elapsedMs, updateDisplayRates);
      sessions.set(playerId, newState);

      if (onTick) onTick(playerId, newState, newMilestones);

      if (newMilestones.length > 0 && onMilestone) {
        for (const m of newMilestones) onMilestone(playerId, m);
      }

      maybeSave(playerId, newState);
    }
  }, TICK_INTERVAL_MS);
}

export function stopTickLoop(): void {
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
}

export function clearAllSessions(): void {
  sessions.clear();
  lastSaved.clear();
  dirty.clear();
}

export function getOnlineCount(): number {
  return sessions.size;
}

export function getGlobalTokensEarned(): number {
  let total = 0;
  for (const state of sessions.values()) {
    total += state.totalTokensEarned.toNumber();
  }
  return total;
}
