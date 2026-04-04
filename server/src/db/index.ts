import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { mkdirSync } from "fs";
import type { GameState, LeaderboardEntry } from "@ai-hype/shared";
import { getFounderTitle } from "@ai-hype/shared";
import { computeScore } from "../game/engine.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH ?? path.join(__dirname, "../../data/game.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  // Ensure the data directory exists
  mkdirSync(path.dirname(DB_PATH), { recursive: true });
  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  migrate(_db);
  return _db;
}

function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      state TEXT NOT NULL,
      score INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_players_score ON players(score DESC);
  `);
}

// ─── Player operations ────────────────────────────────────────────────────────

export function saveState(state: GameState): void {
  const db = getDb();
  const score = computeScore(state);
  const stmt = db.prepare(`
    INSERT INTO players (id, name, state, score, updated_at)
    VALUES (@id, @name, @state, @score, unixepoch())
    ON CONFLICT(id) DO UPDATE SET
      name = @name,
      state = @state,
      score = @score,
      updated_at = unixepoch()
  `);
  stmt.run({ id: state.playerId, name: state.playerName, state: JSON.stringify(state), score });
}

export function loadState(playerId: string): GameState | null {
  const db = getDb();
  const row = db.prepare("SELECT state FROM players WHERE id = ?").get(playerId) as
    | { state: string }
    | undefined;
  if (!row) return null;
  return JSON.parse(row.state) as GameState;
}

export function playerExists(playerId: string): boolean {
  const db = getDb();
  const row = db.prepare("SELECT 1 FROM players WHERE id = ?").get(playerId);
  return !!row;
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

export function getLeaderboard(limit = 20): LeaderboardEntry[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, name, score, state, updated_at
       FROM players
       ORDER BY score DESC
       LIMIT ?`
    )
    .all(limit) as { id: string; name: string; score: number; state: string; updated_at: number }[];

  return rows.map((row, i) => {
    const state = JSON.parse(row.state) as GameState;
    return {
      rank: i + 1,
      playerId: row.id,
      playerName: row.name,
      score: row.score,
      prestigeCount: state.prestigeCount,
      title: getFounderTitle(state.prestigeCount),
      lastActive: row.updated_at * 1000,
    };
  });
}
