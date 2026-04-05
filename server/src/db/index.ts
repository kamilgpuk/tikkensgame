import { createClient } from "@supabase/supabase-js";
import type { GameState, LeaderboardEntry } from "@ai-hype/shared";
import { getFounderTitle } from "@ai-hype/shared";
import { computeScore } from "../game/engine.js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_KEY env vars are required");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

// ─── Player operations ────────────────────────────────────────────────────────

export async function saveState(state: GameState): Promise<void> {
  const score = computeScore(state);
  const { error } = await supabase.from("players").upsert({
    id: state.playerId,
    name: state.playerName,
    state: state,
    score,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`Supabase upsert failed: ${error.message}`);
}

export async function loadState(playerId: string): Promise<GameState | null> {
  const { data, error } = await supabase
    .from("players")
    .select("state")
    .eq("id", playerId)
    .single();
  if (error || !data) return null;
  return data.state as GameState;
}

export async function playerExists(playerId: string): Promise<boolean> {
  const { data } = await supabase
    .from("players")
    .select("id")
    .eq("id", playerId)
    .single();
  return !!data;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface CreatePlayerResult {
  playerId: string;
  nameTaken: boolean;
}

export async function createPlayer(
  playerId: string,
  playerName: string,
  pinHash: string
): Promise<CreatePlayerResult> {
  // Check if name is already taken (case-insensitive)
  const { data: existing } = await supabase
    .from("players")
    .select("id")
    .ilike("name", playerName)
    .limit(1);
  const nameTaken = !!(existing && existing.length > 0);

  // State will be populated by loadOrCreateSession after insert
  const { error } = await supabase.from("players").insert({
    id: playerId,
    name: playerName,
    pin_hash: pinHash,
    state: { playerId, playerName } as unknown as GameState,
    score: 0,
  });
  if (error) throw new Error(error.message);
  return { playerId, nameTaken };
}

export async function findPlayerByNameAndPin(
  playerName: string,
  pinHash: string,
  comparePin: (pin: string, hash: string) => Promise<boolean>,
  inputPin: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("players")
    .select("id, pin_hash")
    .ilike("name", playerName)
    .order("created_at", { ascending: true });

  if (error || !data) return null;

  for (const row of data) {
    if (await comparePin(inputPin, row.pin_hash)) {
      return row.id as string;
    }
  }
  return null;
}

// ─── Reset ────────────────────────────────────────────────────────────────────

export async function resetDb(): Promise<void> {
  const { error } = await supabase.from("players").delete().neq("id", "");
  if (error) console.error("resetDb error:", error.message);
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

export async function getLeaderboard(limit = 20): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase
    .from("players")
    .select("id, name, score, state, updated_at")
    .order("score", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map((row, i) => {
    const state = row.state as GameState;
    return {
      rank: i + 1,
      playerId: row.id as string,
      playerName: row.name as string,
      score: row.score as number,
      prestigeCount: state.prestigeCount,
      title: getFounderTitle(state.prestigeCount),
      lastActive: new Date(row.updated_at as string).getTime(),
    };
  });
}
