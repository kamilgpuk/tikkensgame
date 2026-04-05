/**
 * Layer 6: Database Layer Tests
 * Mocks @supabase/supabase-js with an in-memory implementation.
 * ESM-compatible: jest.unstable_mockModule + dynamic imports.
 */
import { jest, it, expect, beforeEach } from "@jest/globals";

// ─── In-memory Supabase client ────────────────────────────────────────────────

interface Row {
  id: string;
  name: string;
  pin_hash: string;
  state: Record<string, unknown>;
  score: number;
  created_at: string;
  updated_at: string;
}

let dbStore: Row[] = [];

function makeSupabaseClient() {
  return {
    from: (_table: string) => ({
      select: (_cols: string) => ({
        eq: (col: string, val: string) => ({
          single: () => {
            const row = dbStore.find(r => (r as unknown as Record<string, string>)[col] === val);
            return Promise.resolve({ data: row ?? null, error: row ? null : { message: "not found" } });
          },
          ilike: (_col2: string, _val2: string) => ({
            order: (_c: string, _o: object) => Promise.resolve({
              data: dbStore.filter(r => r.name.toLowerCase() === (val as string).toLowerCase()),
              error: null,
            }),
          }),
        }),
        ilike: (col: string, val: string) => ({
          limit: (_n: number) => Promise.resolve({
            data: dbStore.filter(r => r.name.toLowerCase() === val.toLowerCase()),
            error: null,
          }),
          order: (_col: string, _opts: object) => Promise.resolve({
            data: dbStore.filter(r => r.name.toLowerCase() === val.toLowerCase()),
            error: null,
          }),
        }),
        order: (_col: string, _opts: object) => ({
          limit: (n: number) => Promise.resolve({
            data: [...dbStore].sort((a, b) => b.score - a.score).slice(0, n),
            error: null,
          }),
        }),
      }),
      insert: (payload: Row) => {
        dbStore.push({ ...payload, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
        return Promise.resolve({ data: null, error: null });
      },
      update: (payload: Partial<Row>) => ({
        eq: (_col: string, val: string) => {
          const idx = dbStore.findIndex(r => r.id === val);
          if (idx !== -1) dbStore[idx] = { ...dbStore[idx], ...payload };
          return Promise.resolve({ data: null, error: null });
        },
      }),
      delete: () => ({
        neq: (_col: string, _val: string) => {
          dbStore = [];
          return Promise.resolve({ data: null, error: null });
        },
        eq: (_col: string, val: string) => {
          dbStore = dbStore.filter(r => r.id !== val);
          return Promise.resolve({ data: null, error: null });
        },
      }),
    }),
  };
}

jest.unstable_mockModule("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => makeSupabaseClient()),
}));

// ─── Dynamic imports ──────────────────────────────────────────────────────────

const {
  saveState,
  loadState,
  createPlayer,
  findPlayerByNameAndPin,
  resetDb,
  getLeaderboard,
} = await import("./index.js");
const { createInitialState } = await import("../game/engine.js");

beforeEach(() => { dbStore = []; });

// ─── Tests ────────────────────────────────────────────────────────────────────

it("D1: createPlayer inserts row, returns playerId", async () => {
  const result = await createPlayer("pid1", "Alice", "hash:1234");
  expect(result.playerId).toBe("pid1");
  expect(dbStore.some(r => r.id === "pid1")).toBe(true);
});

it("D2: createPlayer sets nameTaken=true for duplicate name", async () => {
  await createPlayer("pid1", "Alice", "h");
  const result = await createPlayer("pid2", "alice", "h");
  expect(result.nameTaken).toBe(true);
});

it("D3: findPlayerByNameAndPin is case-insensitive", async () => {
  await createPlayer("pid3", "Alice", "hash:1234");
  const found = await findPlayerByNameAndPin(
    "alice", "",
    async (pin: string, hash: string) => hash === `hash:${pin}`,
    "1234"
  );
  expect(found).toBe("pid3");
});

it("D4: saveState updates JSONB state for player", async () => {
  await createPlayer("pid4", "Bob", "h");
  const state = { ...createInitialState("pid4", "Bob"), tokens: 999 };
  await saveState(state);
  const row = dbStore.find(r => r.id === "pid4");
  expect((row?.state as { tokens: number })?.tokens).toBe(999);
});

it("D5: loadState returns stored state", async () => {
  await createPlayer("pid5", "Carol", "h");
  const state = createInitialState("pid5", "Carol");
  await saveState(state);
  const loaded = await loadState("pid5");
  expect(loaded?.playerId).toBe("pid5");
});

it("D6: loadState for non-existent player returns null", async () => {
  const result = await loadState("does-not-exist");
  expect(result).toBeNull();
});

it("D7: getLeaderboard returns players sorted by score DESC", async () => {
  await createPlayer("p1", "Low", "h");
  await createPlayer("p2", "High", "h");
  dbStore.find(r => r.id === "p1")!.score = 100;
  dbStore.find(r => r.id === "p2")!.score = 9000;
  const lb = await getLeaderboard(20);
  expect(lb[0].playerName).toBe("High");
  expect(lb[1].playerName).toBe("Low");
});

it("D8: saveState does not overwrite pin_hash", async () => {
  await createPlayer("pid6", "Dave", "secret-hash");
  await saveState(createInitialState("pid6", "Dave"));
  const row = dbStore.find(r => r.id === "pid6");
  expect(row?.pin_hash).toBe("secret-hash");
});

it("D9: round-trip save → load preserves state fields", async () => {
  await createPlayer("pid7", "Eve", "h");
  const state = { ...createInitialState("pid7", "Eve"), tokens: 42, hype: 7, prestigeCount: 2 };
  await saveState(state);
  const loaded = await loadState("pid7");
  expect(loaded?.tokens).toBe(42);
  expect(loaded?.hype).toBe(7);
  expect(loaded?.prestigeCount).toBe(2);
});

it("resetDb wipes all rows", async () => {
  await createPlayer("px", "X", "h");
  await resetDb();
  expect(dbStore).toHaveLength(0);
});
