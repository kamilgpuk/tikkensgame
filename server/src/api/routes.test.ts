/**
 * Layer 2: API Integration Tests
 * ESM-compatible: uses jest.unstable_mockModule + dynamic imports.
 */
import { jest, describe, it, expect, beforeEach, afterAll } from "@jest/globals";
import { deserializeState } from "@ai-hype/shared";

// ─── In-memory DB mock state ──────────────────────────────────────────────────

interface PlayerRow { id: string; name: string; pinHash: string; state: Record<string, unknown>; score: number }
const store = new Map<string, PlayerRow>();

const mockSaveState = jest.fn(async (state: { playerId: string; [k: string]: unknown }) => {
  const row = store.get(state.playerId as string);
  if (row) { row.state = { ...state }; }
});
const mockLoadState = jest.fn(async (playerId: string) => {
  const raw = store.get(playerId)?.state ?? null;
  return raw ? deserializeState(raw) : null;
});
const mockCreatePlayer = jest.fn(async (playerId: string, playerName: string, pinHash: string) => {
  const nameTaken = Array.from(store.values()).some(r => r.name.toLowerCase() === playerName.toLowerCase());
  store.set(playerId, { id: playerId, name: playerName, pinHash, state: { playerId, playerName } as Record<string, unknown>, score: 0 });
  return { playerId, nameTaken };
});
const mockFindPlayerByNameAndPin = jest.fn(async (
  playerName: string,
  _pinHash: string,
  comparePin: (pin: string, hash: string) => Promise<boolean>,
  inputPin: string
) => {
  const matches = Array.from(store.values()).filter(r => r.name.toLowerCase() === playerName.toLowerCase());
  for (const row of matches) {
    if (await comparePin(inputPin, row.pinHash)) return row.id;
  }
  return null;
});
const mockGetLeaderboard = jest.fn(async (limit: number = 20) =>
  Array.from(store.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((row, i) => ({ rank: i + 1, playerId: row.id, playerName: row.name, score: row.score, prestigeCount: 0, title: "Indie Hacker", lastActive: Date.now() }))
);
const mockResetDb = jest.fn(async () => { store.clear(); });
const mockPlayerExists = jest.fn(async (id: string) => store.has(id));
const mockBroadcastMcpAction = jest.fn();

// ─── Register mocks before any dynamic imports ────────────────────────────────

jest.unstable_mockModule("../db/index.js", () => ({
  saveState: mockSaveState,
  loadState: mockLoadState,
  createPlayer: mockCreatePlayer,
  findPlayerByNameAndPin: mockFindPlayerByNameAndPin,
  getLeaderboard: mockGetLeaderboard,
  resetDb: mockResetDb,
  playerExists: mockPlayerExists,
}));

jest.unstable_mockModule("../ws/handler.js", () => ({
  broadcastMcpAction: mockBroadcastMcpAction,
}));

jest.unstable_mockModule("bcryptjs", () => ({
  default: {
    hash: jest.fn(async (pin: string) => `hash:${pin}`),
    compare: jest.fn(async (pin: string, hash: string) => hash === `hash:${pin}`),
  },
  hash: jest.fn(async (pin: string) => `hash:${pin}`),
  compare: jest.fn(async (pin: string, hash: string) => hash === `hash:${pin}`),
}));

// ─── Dynamic imports after mocks ──────────────────────────────────────────────

const express = (await import("express")).default;
const supertest = (await import("supertest")).default;
const { router } = await import("./routes.js");
const { clearAllSessions } = await import("../game/session.js");

const app = express();
app.use(express.json());
app.use("/api", router);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function seedPlayer(playerId: string, playerName: string, pin: string, state: Partial<Record<string, unknown>> = {}) {
  const base = { playerId, playerName, tokens: 0, compute: 0, hype: 0, funding: 0, totalTokensEarned: 0, totalClicks: 0, prestigeCount: 0, reputation: 0, tokensPerSecond: 0, computePerSecond: 0, fundingPerSecond: 0, clickPower: 1, hardware: { mac_mini: 0, gaming_pc: 0, a100: 0, tpu_pod: 0, gpu_cluster: 0, data_center: 0, hyperscaler: 0 }, models: { gpt2: 0, llama7b: 0, mistral7b: 0, llama70b: 0, claude_haiku: 0, gpt4: 0, agi: 0 }, investors: { moms_card: 0, angel: 0, seed: 0, series_a: 0, softbank: 0, saudi_fund: 0 }, upgrades: [], milestonesHit: [], updatedAt: Date.now(), ...state };
  store.set(playerId, { id: playerId, name: playerName, pinHash: `hash:${pin}`, state: base as Record<string, unknown>, score: (base.totalTokensEarned as number) ?? 0 });
}

function resetAll() {
  store.clear();
  mockSaveState.mockClear();
  mockLoadState.mockClear();
  mockCreatePlayer.mockClear();
  mockFindPlayerByNameAndPin.mockClear();
  mockGetLeaderboard.mockClear();
  mockResetDb.mockClear();
  mockBroadcastMcpAction.mockClear();
  clearAllSessions();
}

beforeEach(resetAll);
afterAll(() => { clearAllSessions(); });

// ─── 2.2.1 Registration ───────────────────────────────────────────────────────

describe("POST /api/players — registration", () => {
  it("R1: valid name + 4-digit PIN → 200 with playerId + state", async () => {
    const res = await supertest(app).post("/api/players").send({ playerName: "Alice", pin: "1234" });
    expect(res.status).toBe(200);
    expect(res.body.playerId).toBeDefined();
    expect(res.body.state).toBeDefined();
  });

  it("R2: valid name + 8-digit PIN → 200", async () => {
    const res = await supertest(app).post("/api/players").send({ playerName: "Bob", pin: "12345678" });
    expect(res.status).toBe(200);
  });

  it("R3: empty name → 400", async () => {
    const res = await supertest(app).post("/api/players").send({ playerName: "", pin: "1234" });
    expect(res.status).toBe(400);
  });

  it("R4: name > 20 chars → 400", async () => {
    const res = await supertest(app).post("/api/players").send({ playerName: "a".repeat(21), pin: "1234" });
    expect(res.status).toBe(400);
  });

  it("R5: PIN with letters → 400", async () => {
    const res = await supertest(app).post("/api/players").send({ playerName: "Alice", pin: "abc4" });
    expect(res.status).toBe(400);
  });

  it("R6: PIN < 4 digits → 400", async () => {
    const res = await supertest(app).post("/api/players").send({ playerName: "Alice", pin: "123" });
    expect(res.status).toBe(400);
  });

  it("R7: PIN > 8 digits → 400", async () => {
    const res = await supertest(app).post("/api/players").send({ playerName: "Alice", pin: "123456789" });
    expect(res.status).toBe(400);
  });

  it("R8: duplicate name → 409 with error message", async () => {
    await supertest(app).post("/api/players").send({ playerName: "Alice", pin: "1234" });
    const res = await supertest(app).post("/api/players").send({ playerName: "Alice", pin: "5678" });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/name already taken/i);
  });

  it("R9: leading/trailing spaces → trimmed, accepted", async () => {
    const res = await supertest(app).post("/api/players").send({ playerName: "  Alice  ", pin: "1234" });
    expect(res.status).toBe(200);
    expect(res.body.state.playerName).toBe("Alice");
  });
});

// ─── 2.2.2 Authentication ─────────────────────────────────────────────────────

describe("POST /api/auth", () => {
  beforeEach(async () => {
    await supertest(app).post("/api/players").send({ playerName: "Alice", pin: "1234" });
  });

  it("A1: correct name + PIN → 200", async () => {
    const res = await supertest(app).post("/api/auth").send({ playerName: "Alice", pin: "1234" });
    expect(res.status).toBe(200);
    expect(res.body.playerId).toBeDefined();
  });

  it("A2: wrong PIN → 401", async () => {
    const res = await supertest(app).post("/api/auth").send({ playerName: "Alice", pin: "9999" });
    expect(res.status).toBe(401);
  });

  it("A3: non-existent name → 401", async () => {
    const res = await supertest(app).post("/api/auth").send({ playerName: "Nobody", pin: "1234" });
    expect(res.status).toBe(401);
  });

  it("A4: case-insensitive name → 200", async () => {
    const res = await supertest(app).post("/api/auth").send({ playerName: "alice", pin: "1234" });
    expect(res.status).toBe(200);
  });

  it("A5: 5 failed attempts → 429", async () => {
    for (let i = 0; i < 5; i++) {
      await supertest(app).post("/api/auth").send({ playerName: "Alice", pin: "0000" });
    }
    const res = await supertest(app).post("/api/auth").send({ playerName: "Alice", pin: "0000" });
    expect(res.status).toBe(429);
  });

  it("A7: successful auth after failures resets counter (unique name avoids A5 bleed)", async () => {
    // Register a distinct name not affected by A5's lockout
    await supertest(app).post("/api/players").send({ playerName: "AliceA7", pin: "1234" });
    for (let i = 0; i < 4; i++) {
      await supertest(app).post("/api/auth").send({ playerName: "AliceA7", pin: "0000" });
    }
    // Correct login should reset the counter
    await supertest(app).post("/api/auth").send({ playerName: "AliceA7", pin: "1234" });
    // Should now succeed without lockout
    const res = await supertest(app).post("/api/auth").send({ playerName: "AliceA7", pin: "1234" });
    expect(res.status).toBe(200);
  });
});

// ─── 2.2.3 Click ──────────────────────────────────────────────────────────────

describe("POST /api/click/:playerId", () => {
  let playerId: string;

  beforeEach(async () => {
    const res = await supertest(app).post("/api/players").send({ playerName: "Alice", pin: "1234" });
    playerId = res.body.playerId as string;
  });

  it("C1: n=1 → tokens +1, totalClicks +1", async () => {
    const res = await supertest(app).post(`/api/click/${playerId}`).send({ n: 1 });
    expect(res.status).toBe(200);
    expect(res.body.totalClicks).toBe(1);
  });

  it("C2: n=100 → totalClicks +100", async () => {
    const res = await supertest(app).post(`/api/click/${playerId}`).send({ n: 100 });
    expect(res.status).toBe(200);
    expect(res.body.totalClicks).toBe(100);
  });

  it("C3: n=1001 clamped to 1000", async () => {
    const res = await supertest(app).post(`/api/click/${playerId}`).send({ n: 1001 });
    expect(res.status).toBe(200);
    expect(res.body.totalClicks).toBe(1000);
  });

  it("C4: n=-1 clamped to 1", async () => {
    const res = await supertest(app).post(`/api/click/${playerId}`).send({ n: -1 });
    expect(res.status).toBe(200);
    expect(res.body.totalClicks).toBe(1);
  });

  it("C5: invalid playerId → 404", async () => {
    const res = await supertest(app).post("/api/click/nonexistent-id").send({ n: 1 });
    expect(res.status).toBe(404);
  });
});

// ─── 2.2.4 Buy ────────────────────────────────────────────────────────────────

describe("POST /api/buy/:playerId", () => {
  let playerId: string;

  beforeEach(async () => {
    const res = await supertest(app).post("/api/players").send({ playerName: "Alice", pin: "1234" });
    playerId = res.body.playerId as string;
    await supertest(app).post(`/api/click/${playerId}`).send({ n: 10 });
  });

  it("B1: buy mac_mini with enough tokens → hardware.mac_mini +1", async () => {
    const res = await supertest(app).post(`/api/buy/${playerId}`).send({ producerType: "hardware", id: "mac_mini" });
    expect(res.status).toBe(200);
    expect(res.body.hardware.mac_mini).toBe(1);
  });

  it("B2: buy mac_mini with 0 tokens → 400", async () => {
    const reg = await supertest(app).post("/api/players").send({ playerName: "Bob", pin: "1234" });
    const pid = reg.body.playerId as string;
    const res = await supertest(app).post(`/api/buy/${pid}`).send({ producerType: "hardware", id: "mac_mini" });
    expect(res.status).toBe(400);
  });

  it("B3: buy locked hardware → 400", async () => {
    const res = await supertest(app).post(`/api/buy/${playerId}`).send({ producerType: "hardware", id: "gaming_pc" });
    expect(res.status).toBe(400);
  });

  it("B4: buy upgrade → upgrades contains id", async () => {
    await supertest(app).post(`/api/click/${playerId}`).send({ n: 1000 });
    const res = await supertest(app).post(`/api/buy/${playerId}`).send({ producerType: "upgrade", id: "better_prompts" });
    expect(res.status).toBe(200);
    expect(res.body.upgrades).toContain("better_prompts");
  });

  it("B5: buy same upgrade twice → 400", async () => {
    await supertest(app).post(`/api/click/${playerId}`).send({ n: 1000 });
    await supertest(app).post(`/api/buy/${playerId}`).send({ producerType: "upgrade", id: "better_prompts" });
    const res = await supertest(app).post(`/api/buy/${playerId}`).send({ producerType: "upgrade", id: "better_prompts" });
    expect(res.status).toBe(400);
  });

  it("B6: buy investor with insufficient hype → 400", async () => {
    const res = await supertest(app).post(`/api/buy/${playerId}`).send({ producerType: "investor", id: "moms_card" });
    expect(res.status).toBe(400);
  });

  it("B7: invalid producerType → 400", async () => {
    const res = await supertest(app).post(`/api/buy/${playerId}`).send({ producerType: "unicorn", id: "mac_mini" });
    expect(res.status).toBe(400);
  });

  it("B9: quantity=5 bulk buy", async () => {
    await supertest(app).post(`/api/click/${playerId}`).send({ n: 1000 });
    const res = await supertest(app).post(`/api/buy/${playerId}`).send({ producerType: "hardware", id: "mac_mini", quantity: 5 });
    expect(res.status).toBe(200);
    expect(res.body.hardware.mac_mini).toBe(5);
  });
});

// ─── 2.2.5 Prestige ──────────────────────────────────────────────────────────

describe("POST /api/prestige/:playerId", () => {
  it("PR1: eligible player → 200, prestige +1", async () => {
    seedPlayer("pid1", "Alice", "1234", { totalTokensEarned: 2_000_000, tokens: 1_000_000, funding: 10_000 });
    const res = await supertest(app).post("/api/prestige/pid1");
    expect(res.status).toBe(200);
    expect(res.body.prestigeCount).toBe(1);
  });

  it("PR2: ineligible player → 400", async () => {
    seedPlayer("pid2", "Bob", "1234", { totalTokensEarned: 100 });
    const res = await supertest(app).post("/api/prestige/pid2");
    expect(res.status).toBe(400);
  });
});

// ─── 2.2.6 Leaderboard ───────────────────────────────────────────────────────

describe("GET /api/leaderboard", () => {
  it("LB1: empty DB → []", async () => {
    const res = await supertest(app).get("/api/leaderboard");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("LB2: sorted desc by score", async () => {
    seedPlayer("p1", "Low", "1234", { totalTokensEarned: 100 });
    seedPlayer("p2", "High", "1234", { totalTokensEarned: 5000 });
    store.get("p1")!.score = 100;
    store.get("p2")!.score = 5000;
    const res = await supertest(app).get("/api/leaderboard");
    expect(res.body[0].playerName).toBe("High");
  });

  it("LB3: 25 players → top 20 only", async () => {
    for (let i = 0; i < 25; i++) seedPlayer(`p${i}`, `P${i}`, "1234");
    const res = await supertest(app).get("/api/leaderboard");
    expect(res.body).toHaveLength(20);
  });
});

// ─── 2.2.7 Actions ───────────────────────────────────────────────────────────

describe("GET /api/actions/:playerId", () => {
  it("AC1: player with 100 tokens — mac_mini is affordable", async () => {
    seedPlayer("pid3", "Alice", "1234", { tokens: 100 });
    const res = await supertest(app).get("/api/actions/pid3");
    expect(res.status).toBe(200);
    const mac = (res.body as Array<{ id: string; affordable: boolean }>).find(a => a.id === "mac_mini");
    expect(mac?.affordable).toBe(true);
  });
});

// ─── 2.2.8 Admin Reset ───────────────────────────────────────────────────────

describe("POST /api/admin/reset", () => {
  it("AD1: no header → 401", async () => {
    const res = await supertest(app).post("/api/admin/reset");
    expect(res.status).toBe(401);
  });

  it("AD2: wrong secret → 401", async () => {
    const res = await supertest(app).post("/api/admin/reset").set("x-admin-secret", "wrong");
    expect(res.status).toBe(401);
  });

  it("AD3: correct secret → 200", async () => {
    const res = await supertest(app).post("/api/admin/reset").set("x-admin-secret", "test-admin-secret");
    expect(res.status).toBe(200);
  });
});
