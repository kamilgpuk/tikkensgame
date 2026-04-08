import type { GameState } from "@ai-hype/shared";
import { getFounderTitle, prestigeFundingThreshold, prestigeTokenThreshold, reputationMultiplier } from "@ai-hype/shared";
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

  const tokenThreshold = prestigeTokenThreshold(state.prestigeCount);
  const fundingThreshold = prestigeFundingThreshold(state.prestigeCount);
  const tokensOk = state.totalTokensEarned.gte(tokenThreshold);
  const fundingOk = state.funding.gte(fundingThreshold);
  const eligible = tokensOk && fundingOk;

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>go IPO</h2>
        <p>reset everything and emerge wiser.</p>
        <div className="prestige-gains">
          <div className="gain-row" style={{ color: tokensOk ? "#4caf50" : "#f44336" }}>
            <span>tokens earned</span>
            <span>{fmt(state.totalTokensEarned)} / {fmt(tokenThreshold)}</span>
          </div>
          <div className="gain-row" style={{ color: fundingOk ? "#4caf50" : "#f44336" }}>
            <span>funding</span>
            <span>{fmt(state.funding)} / {fmt(fundingThreshold)} F</span>
          </div>
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
            <span>{fmt(fundingThreshold)} F consumed</span>
          </div>
          <div className="gain-row warning">
            <span>tokens lost</span>
            <span>{fmt(state.tokens)} T gone</span>
          </div>
        </div>
        <div className="modal-actions">
          <button
            className="btn-confirm"
            onClick={onConfirm}
            disabled={!eligible}
            style={!eligible ? { opacity: 0.4, cursor: "not-allowed" } : undefined}
          >
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
