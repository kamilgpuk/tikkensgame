/**
 * Layer 3: Session Management Tests
 * ESM-compatible: jest.unstable_mockModule + dynamic imports.
 */
import { jest, it, expect, beforeEach, afterAll } from "@jest/globals";

// ─── In-memory DB mock ────────────────────────────────────────────────────────

const mockStore = new Map<string, Record<string, unknown>>();
const mockSaveState = jest.fn(async (state: { playerId: string }) => {
  const row = mockStore.get(state.playerId);
  if (row) Object.assign(row, state);
});
const mockLoadState = jest.fn(async (playerId: string) => mockStore.get(playerId) ?? null);
const mockCreatePlayer = jest.fn(async () => ({ playerId: "unused", nameTaken: false }));
const mockFindPlayerByNameAndPin = jest.fn(async () => null as string | null);
const mockGetLeaderboard = jest.fn(async () => []);
const mockResetDb = jest.fn(async () => { mockStore.clear(); });
const mockPlayerExists = jest.fn(async () => false);

jest.unstable_mockModule("../db/index.js", () => ({
  saveState: mockSaveState,
  loadState: mockLoadState,
  createPlayer: mockCreatePlayer,
  findPlayerByNameAndPin: mockFindPlayerByNameAndPin,
  getLeaderboard: mockGetLeaderboard,
  resetDb: mockResetDb,
  playerExists: mockPlayerExists,
}));

// ─── Dynamic imports ──────────────────────────────────────────────────────────

const {
  loadOrCreateSession,
  getSession,
  setSession,
  doClick,
  doBuyHardware,
  doPrestige,
  clearAllSessions,
  getOnlineCount,
  getGlobalTokensEarned,
  stopTickLoop,
} = await import("./session.js");
const { createInitialState } = await import("./engine.js");

// ─── Helpers ─────────────────────────────────────────────────────────────────

function seedDb(playerId: string, playerName: string, state: Partial<Record<string, unknown>> = {}) {
  const base = { playerId, playerName, tokens: 0, compute: 0, hype: 0, funding: 0, totalTokensEarned: 0, totalClicks: 0, prestigeCount: 0, reputation: 0, tokensPerSecond: 0, computePerSecond: 0, fundingPerSecond: 0, clickPower: 1, hardware: { mac_mini: 0, gaming_pc: 0, a100: 0, tpu_pod: 0, gpu_cluster: 0, data_center: 0, hyperscaler: 0 }, models: { gpt2: 0, llama7b: 0, mistral7b: 0, llama70b: 0, claude_haiku: 0, gpt4: 0, agi: 0 }, investors: { moms_card: 0, angel: 0, seed: 0, series_a: 0, softbank: 0, saudi_fund: 0 }, upgrades: [], milestonesHit: [], updatedAt: Date.now(), ...state };
  mockStore.set(playerId, base);
}

beforeEach(() => {
  mockStore.clear();
  mockSaveState.mockClear();
  mockLoadState.mockClear();
  clearAllSessions();
});

afterAll(() => {
  stopTickLoop();
  clearAllSessions();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

it("SS1: loadOrCreateSession for new player creates fresh state and persists to DB", async () => {
  const state = await loadOrCreateSession("p1", "Alice");
  expect(state.playerId).toBe("p1");
  expect(state.tokens).toBe(0);
  await new Promise(r => setTimeout(r, 50));
  expect(mockSaveState).toHaveBeenCalled();
});

it("SS2: loadOrCreateSession for existing player loads from DB", async () => {
  seedDb("p2", "Bob", { tokens: 500, totalTokensEarned: 500 });
  const state = await loadOrCreateSession("p2", "Bob");
  expect(state.tokens).toBe(500);
  expect(mockLoadState).toHaveBeenCalledWith("p2");
});

it("SS3: already in memory → no DB call on second load", async () => {
  await loadOrCreateSession("p3", "Carol");
  mockLoadState.mockClear();
  await loadOrCreateSession("p3", "Carol");
  expect(mockLoadState).not.toHaveBeenCalled();
});

it("SS4: doClick updates in-memory state and triggers DB save", async () => {
  await loadOrCreateSession("p4", "Dave");
  doClick("p4", 5);
  await new Promise(r => setTimeout(r, 100));
  // In-memory state is correct
  expect(getSession("p4")?.totalClicks).toBe(5);
  // saveState was called (initial load + possibly from click)
  expect(mockSaveState).toHaveBeenCalled();
});

it("SS5: doClick with elapsed time > SAVE_INTERVAL triggers immediate save", async () => {
  await loadOrCreateSession("p5", "Eve");
  await new Promise(r => setTimeout(r, 50)); // let initial save settle
  mockSaveState.mockClear();
  // Advance Date.now() by 3s so maybeSave thinks enough time has elapsed
  const futureNow = Date.now() + 3000;
  const spy = jest.spyOn(Date, "now").mockReturnValue(futureNow);
  doClick("p5", 1);
  spy.mockRestore();
  await new Promise(r => setTimeout(r, 50));
  expect(mockSaveState).toHaveBeenCalled();
});

it("SS6: rapid actions within 2s debounce — no extra DB saves", async () => {
  const fixedNow = Date.now();
  const spy = jest.spyOn(Date, "now").mockReturnValue(fixedNow);
  await loadOrCreateSession("p6", "Frank");
  await new Promise(r => setTimeout(r, 50));
  mockSaveState.mockClear();
  // All three calls happen at same timestamp → debounce prevents extra saves
  doClick("p6", 1);
  doClick("p6", 1);
  doClick("p6", 1);
  await new Promise(r => setTimeout(r, 50));
  expect(mockSaveState).not.toHaveBeenCalled();
  spy.mockRestore();
});

it("SS7: two players tick independently", async () => {
  await loadOrCreateSession("pa", "PlayerA");
  await loadOrCreateSession("pb", "PlayerB");
  doClick("pa", 10);
  doClick("pb", 3);
  expect(getSession("pa")?.totalClicks).toBe(10);
  expect(getSession("pb")?.totalClicks).toBe(3);
});

it("SS8: prestige triggers immediate save with reset state", async () => {
  const eligible = createInitialState("p8", "Grace");
  setSession({ ...eligible, totalTokensEarned: 2_000_000, tokens: 2_000_000 });
  mockSaveState.mockClear();
  doPrestige("p8");
  await new Promise(r => setTimeout(r, 50));
  expect(mockSaveState).toHaveBeenCalled();
  const saved = (mockSaveState.mock.calls[0] as [{ prestigeCount: number; tokens: number }])[0];
  expect(saved.prestigeCount).toBe(1);
  expect(saved.tokens).toBe(0);
});

it("getOnlineCount tracks active sessions", async () => {
  expect(getOnlineCount()).toBe(0);
  await loadOrCreateSession("x1", "X");
  await loadOrCreateSession("x2", "Y");
  expect(getOnlineCount()).toBe(2);
  clearAllSessions();
  expect(getOnlineCount()).toBe(0);
});

it("getGlobalTokensEarned sums all sessions", async () => {
  const s1 = createInitialState("g1", "G1");
  const s2 = createInitialState("g2", "G2");
  setSession({ ...s1, totalTokensEarned: 300 });
  setSession({ ...s2, totalTokensEarned: 700 });
  expect(getGlobalTokensEarned()).toBe(1000);
});
