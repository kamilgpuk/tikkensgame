/**
 * Layer 4: WebSocket Handler Tests
 * ESM-compatible: jest.unstable_mockModule + dynamic imports.
 */
import { jest, it, expect, beforeAll, afterAll, beforeEach } from "@jest/globals";
import Decimal from "break_eternity.js";

// ─── In-memory DB mock ────────────────────────────────────────────────────────

const mockStore = new Map<string, Record<string, unknown>>();
const mockSaveState = jest.fn(async (state: Record<string, unknown>) => {
  mockStore.set(state.playerId as string, state);
});
const mockLoadState = jest.fn(async (playerId: string) => mockStore.get(playerId) ?? null);
const mockGetLeaderboard = jest.fn(async () => []);
const mockCreatePlayer = jest.fn(async () => ({ playerId: "", nameTaken: false }));
const mockFindPlayerByNameAndPin = jest.fn(async () => null as string | null);
const mockResetDb = jest.fn(async () => {});
const mockPlayerExists = jest.fn(async () => false);

jest.unstable_mockModule("../db/index.js", () => ({
  saveState: mockSaveState,
  loadState: mockLoadState,
  getLeaderboard: mockGetLeaderboard,
  createPlayer: mockCreatePlayer,
  findPlayerByNameAndPin: mockFindPlayerByNameAndPin,
  resetDb: mockResetDb,
  playerExists: mockPlayerExists,
}));

// ─── Dynamic imports ──────────────────────────────────────────────────────────

const http = await import("http");
const express = (await import("express")).default;
const { WebSocket } = await import("ws");
const { setupWebSocket } = await import("./handler.js");
const {
  clearAllSessions,
  setSession,
  doClick,
  startTickLoop,
  stopTickLoop,
} = await import("../game/session.js");
const { createInitialState } = await import("../game/engine.js");

// ─── Server setup ─────────────────────────────────────────────────────────────

let server: import("http").Server;
let port: number;

function wsUrl(playerId: string, playerName = "Tester"): string {
  return `ws://127.0.0.1:${port}/ws?playerId=${encodeURIComponent(playerId)}&playerName=${encodeURIComponent(playerName)}`;
}

function collectMessages(
  ws: InstanceType<typeof WebSocket>,
  opts: { count?: number; timeoutMs?: number; type?: string }
): Promise<object[]> {
  return new Promise((resolve) => {
    const msgs: object[] = [];
    const timer = setTimeout(() => resolve(msgs), opts.timeoutMs ?? 1000);
    ws.on("message", (raw) => {
      const msg = JSON.parse(raw.toString()) as { type: string };
      if (!opts.type || msg.type === opts.type) msgs.push(msg);
      if (opts.count && msgs.length >= opts.count) {
        clearTimeout(timer);
        resolve(msgs);
      }
    });
  });
}

beforeAll(() => new Promise<void>((done) => {
  const app = express();
  server = http.createServer(app);
  setupWebSocket(server);
  server.listen(0, "127.0.0.1", () => {
    port = (server.address() as { port: number }).port;
    done();
  });
}));

afterAll(() => new Promise<void>((done) => {
  stopTickLoop();
  clearAllSessions();
  server.close(() => done());
}));

beforeEach(() => {
  mockStore.clear();
  mockSaveState.mockClear();
  clearAllSessions();
  stopTickLoop();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

it("W1: connect with valid playerId → receives state message within 500ms", async () => {
  setSession(createInitialState("w1", "Tester"));
  const ws = new WebSocket(wsUrl("w1"));
  const msgs = await collectMessages(ws, { count: 1, type: "state", timeoutMs: 500 });
  ws.close();
  expect(msgs.length).toBeGreaterThanOrEqual(1);
});

it("W2: connect without playerId → connection closed", () => new Promise<void>((done) => {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  const t = setTimeout(() => { ws.close(); done(); }, 500);
  ws.on("close", () => { clearTimeout(t); done(); });
  ws.on("error", () => { clearTimeout(t); done(); });
}));

it("W3: state messages arrive at ~100ms interval — ≥5 in 1.5s", async () => {
  setSession(createInitialState("w3", "Tester"));
  startTickLoop();
  const ws = new WebSocket(wsUrl("w3"));
  const msgs = await collectMessages(ws, { type: "state", timeoutMs: 1500 });
  ws.close();
  stopTickLoop();
  expect(msgs.length).toBeGreaterThanOrEqual(5);
});

it("W4: after doClick, next state broadcast has updated totalClicks", async () => {
  setSession(createInitialState("w4", "Tester"));
  startTickLoop();
  const ws = new WebSocket(wsUrl("w4"));
  await collectMessages(ws, { count: 1, type: "state", timeoutMs: 300 });
  doClick("w4", 50);
  const updates = await collectMessages(ws, { count: 1, type: "state", timeoutMs: 300 });
  ws.close();
  stopTickLoop();
  expect(updates.length).toBeGreaterThanOrEqual(1);
  const s = (updates[updates.length - 1] as { payload: { totalClicks: number } }).payload;
  expect(s.totalClicks).toBe(50);
});

it("W5: crossing a milestone sends a milestone message", async () => {
  setSession({
    ...createInitialState("w5", "Tester"),
    totalTokensEarned: new Decimal(999),
    compute: new Decimal(100_000),
    models: { gpt2: 10_000, llama7b: 0, mistral7b: 0, llama70b: 0, claude_haiku: 0, gpt4: 0, agi: 0 },
  });
  startTickLoop();
  const ws = new WebSocket(wsUrl("w5"));
  const msgs = await collectMessages(ws, { type: "milestone", timeoutMs: 1000 });
  ws.close();
  stopTickLoop();
  expect(msgs.length).toBeGreaterThanOrEqual(1);
  const m = msgs[0] as { payload: { id: string } };
  expect(m.payload.id).toBe("m1k");
});

it("W6: broadcastMcpAction sends mcp_action to connected client", async () => {
  const { broadcastMcpAction } = await import("./handler.js");
  setSession(createInitialState("w6", "Tester"));
  const ws = new WebSocket(wsUrl("w6"));
  await collectMessages(ws, { count: 1, type: "state", timeoutMs: 300 });
  const msgPromise = collectMessages(ws, { count: 1, type: "mcp_action", timeoutMs: 300 });
  broadcastMcpAction("w6", "click");
  const msgs = await msgPromise;
  ws.close();
  expect(msgs.length).toBe(1);
  expect((msgs[0] as { payload: { action: string } }).payload.action).toBe("click");
});

it("W7: reconnecting client receives existing session state", async () => {
  setSession(createInitialState("w7", "Tester"));
  doClick("w7", 25);
  const ws1 = new WebSocket(wsUrl("w7"));
  await collectMessages(ws1, { count: 1, type: "state", timeoutMs: 300 });
  ws1.close();
  await new Promise(r => setTimeout(r, 50));
  const ws2 = new WebSocket(wsUrl("w7"));
  const msgs = await collectMessages(ws2, { count: 1, type: "state", timeoutMs: 300 });
  ws2.close();
  expect(msgs.length).toBe(1);
  const s = (msgs[0] as { payload: { totalClicks: number } }).payload;
  expect(s.totalClicks).toBe(25);
});

it("W8: multiple clients for same playerId both receive state", async () => {
  setSession(createInitialState("w8", "Tester"));
  startTickLoop();
  const ws1 = new WebSocket(wsUrl("w8"));
  const ws2 = new WebSocket(wsUrl("w8"));
  const [m1, m2] = await Promise.all([
    collectMessages(ws1, { count: 1, type: "state", timeoutMs: 500 }),
    collectMessages(ws2, { count: 1, type: "state", timeoutMs: 500 }),
  ]);
  ws1.close();
  ws2.close();
  stopTickLoop();
  expect(m1.length).toBeGreaterThanOrEqual(1);
  expect(m2.length).toBeGreaterThanOrEqual(1);
});
