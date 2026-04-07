/**
 * In-memory mock for db/index.ts — used in all server-side tests that call jest.mock('../db/index.js')
 * Provides jest.fn() wrappers around an in-memory Map store.
 * Call __resetStore() in beforeEach/afterEach to isolate tests.
 */
import { jest } from "@jest/globals";
import Decimal from "break_eternity.js";
import type { GameState, LeaderboardEntry } from "@ai-hype/shared";

interface PlayerRow {
  id: string;
  name: string;
  pinHash: string;
  state: GameState;
  score: number;
}

let store = new Map<string, PlayerRow>();

function scoreOf(state: GameState): number {
  const tte = state.totalTokensEarned instanceof Decimal ? state.totalTokensEarned.toNumber() : 0;
  return (
    tte +
    (state.prestigeCount ?? 0) * 1_000_000 +
    (state.reputation ?? 0) * 500_000
  );
}

export const saveState = jest.fn(async (state: GameState): Promise<void> => {
  const row = store.get(state.playerId);
  if (row) {
    row.state = { ...state };
    row.score = scoreOf(state);
  }
});

export const loadState = jest.fn(async (playerId: string): Promise<GameState | null> => {
  return store.get(playerId)?.state ?? null;
});

export const playerExists = jest.fn(async (playerId: string): Promise<boolean> => {
  return store.has(playerId);
});

export interface CreatePlayerResult {
  playerId: string;
  nameTaken: boolean;
}

export const createPlayer = jest.fn(async (
  playerId: string,
  playerName: string,
  pinHash: string
): Promise<CreatePlayerResult> => {
  const nameTaken = Array.from(store.values()).some(
    (row) => row.name.toLowerCase() === playerName.toLowerCase()
  );
  store.set(playerId, {
    id: playerId,
    name: playerName,
    pinHash,
    state: { playerId, playerName } as GameState,
    score: 0,
  });
  return { playerId, nameTaken };
});

export const findPlayerByNameAndPin = jest.fn(async (
  playerName: string,
  _pinHash: string,
  comparePin: (pin: string, hash: string) => Promise<boolean>,
  inputPin: string
): Promise<string | null> => {
  const matches = Array.from(store.values()).filter(
    (row) => row.name.toLowerCase() === playerName.toLowerCase()
  );
  for (const row of matches) {
    if (await comparePin(inputPin, row.pinHash)) return row.id;
  }
  return null;
});

export const resetDb = jest.fn(async (): Promise<void> => {
  store.clear();
});

export const getLeaderboard = jest.fn(async (limit: number = 20): Promise<LeaderboardEntry[]> => {
  return Array.from(store.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((row, i) => ({
      rank: i + 1,
      playerId: row.id,
      playerName: row.name,
      score: row.score,
      prestigeCount: row.state?.prestigeCount ?? 0,
      title: "Indie Hacker",
      lastActive: Date.now(),
    }));
});

/** Call in beforeEach/afterEach to reset store and mock call counts. */
export const __resetStore = (): void => {
  store.clear();
  saveState.mockClear();
  loadState.mockClear();
  playerExists.mockClear();
  createPlayer.mockClear();
  findPlayerByNameAndPin.mockClear();
  resetDb.mockClear();
  getLeaderboard.mockClear();
};

/** Seed a player row directly (useful for auth tests). */
export const __seedPlayer = (
  playerId: string,
  playerName: string,
  pinHash: string,
  state?: Partial<GameState>
): void => {
  const base: GameState = {
    playerId,
    playerName,
    tokens: new Decimal(0), compute: new Decimal(0), hype: 0, funding: new Decimal(0),
    totalTokensEarned: new Decimal(0), totalClicks: 0, prestigeCount: 0, reputation: 0,
    tokensPerSecond: new Decimal(0), computePerSecond: new Decimal(0), fundingPerSecond: new Decimal(0), clickPower: new Decimal(1),
    hardware: { mac_mini: 0, gaming_pc: 0, a100: 0, tpu_pod: 0, gpu_cluster: 0, data_center: 0, hyperscaler: 0 },
    models: { gpt2: 0, llama7b: 0, mistral7b: 0, llama70b: 0, claude_haiku: 0, gpt4: 0, agi: 0 },
    investors: { moms_card: 0, angel: 0, seed: 0, series_a: 0, softbank: 0, saudi_fund: 0 },
    upgrades: [], milestonesHit: [], updatedAt: Date.now(),
    ...(state ?? {}),
  };
  store.set(playerId, { id: playerId, name: playerName, pinHash, state: base, score: scoreOf(base) });
};
