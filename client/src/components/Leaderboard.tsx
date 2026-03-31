import type { LeaderboardEntry } from "@ai-hype/shared";
import { fmt } from "../lib/format.js";

interface Props {
  entries: LeaderboardEntry[];
  currentPlayerId: string | null;
}

export function Leaderboard({ entries, currentPlayerId }: Props) {
  if (entries.length === 0) return null;
  return (
    <div className="leaderboard">
      <h3>leaderboard</h3>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>name</th>
            <th>score</th>
            <th>title</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.playerId} className={e.playerId === currentPlayerId ? "me" : ""}>
              <td>{e.rank}</td>
              <td>{e.playerName}</td>
              <td>{fmt(e.score)}</td>
              <td>{e.title}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
