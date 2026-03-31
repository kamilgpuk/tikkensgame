import type { GameState } from "@ai-hype/shared";
import { fmt, fmtRate } from "../lib/format.js";

interface Props {
  state: GameState;
}

export function ResourceBar({ state }: Props) {
  const canPrestige = state.totalTokensEarned >= 1_000_000;

  return (
    <div className="resource-bar">
      <div className="resource">
        <span className="label">tokens</span>
        <span className="value">{fmt(state.tokens)}</span>
        <span className="rate">{fmtRate(state.tokensPerSecond)}</span>
      </div>
      <div className="resource">
        <span className="label">compute</span>
        <span className="value">{fmt(state.compute)}</span>
        <span className={`rate ${state.computePerSecond < 0 ? "negative" : ""}`}>
          {state.computePerSecond >= 0 ? "+" : ""}{fmtRate(state.computePerSecond)}
        </span>
      </div>
      <div className="resource">
        <span className="label">hype</span>
        <span className="value">{state.hype.toFixed(1)}</span>
        <span className="rate">×{(1 + state.hype).toFixed(1)} multiplier</span>
      </div>
      <div className="resource">
        <span className="label">funding</span>
        <span className="value">${fmt(state.funding)}</span>
        <span className="rate">{fmtRate(state.fundingPerSecond)}</span>
      </div>
      {state.prestigeCount > 0 && (
        <div className="resource">
          <span className="label">reputation</span>
          <span className="value">{state.reputation}</span>
          <span className="rate">×{(1 + state.reputation * 0.5).toFixed(1)} bonus</span>
        </div>
      )}
      {canPrestige && (
        <div className="prestige-hint">
          ★ ready to launch a startup
        </div>
      )}
    </div>
  );
}
