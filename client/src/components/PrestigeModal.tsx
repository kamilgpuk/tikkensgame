import type { GameState } from "@ai-hype/shared";
import { getFounderTitle, prestigeFundingThreshold, reputationMultiplier } from "@ai-hype/shared";
import { fmt } from "../lib/format.js";

interface Props {
  state: GameState;
  onConfirm: () => void;
  onCancel: () => void;
}

export function PrestigeModal({ state, onConfirm, onCancel }: Props) {
  const reputationGain = Math.floor(
    Math.log10(Math.max(1, state.totalTokensEarned.toNumber()))
  );
  const newReputation = state.reputation + reputationGain;
  const newTitle = getFounderTitle(state.prestigeCount + 1);

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>launch a startup</h2>
        <p>reset everything and emerge wiser.</p>
        <div className="prestige-gains">
          <div className="gain-row">
            <span>reputation gained</span>
            <span>+{reputationGain} → {newReputation} total</span>
          </div>
          <div className="gain-row">
            <span>new token multiplier</span>
            <span>×{reputationMultiplier(newReputation).toFixed(1)}</span>
          </div>
          <div className="gain-row">
            <span>new title</span>
            <span>{newTitle}</span>
          </div>
          <div className="gain-row warning">
            <span>funding spent</span>
            <span>{fmt(prestigeFundingThreshold(state.prestigeCount))} F consumed</span>
          </div>
          <div className="gain-row warning">
            <span>tokens lost</span>
            <span>{fmt(state.tokens)} T gone</span>
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn-confirm" onClick={onConfirm}>
            launch
          </button>
          <button className="btn-cancel" onClick={onCancel}>
            not yet
          </button>
        </div>
      </div>
    </div>
  );
}
