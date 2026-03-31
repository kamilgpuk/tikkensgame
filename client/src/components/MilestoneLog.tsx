import type { MilestoneEvent } from "../hooks/useGame.js";

interface Props {
  milestones: MilestoneEvent[];
}

export function MilestoneLog({ milestones }: Props) {
  if (milestones.length === 0) return null;
  return (
    <div className="milestone-log">
      <h3>events</h3>
      <ul>
        {milestones.map((m) => (
          <li key={m.ts}>
            <span className="milestone-msg">{m.message}</span>
            <span className="milestone-hype">+{m.hypeGain} hype</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
