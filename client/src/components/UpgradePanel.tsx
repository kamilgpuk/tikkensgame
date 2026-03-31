import type { GameState } from "@ai-hype/shared";
import { UPGRADES } from "@ai-hype/shared";
import { fmt } from "../lib/format.js";

interface Props {
  state: GameState;
  onBuy: (id: string) => void;
}

export function UpgradePanel({ state, onBuy }: Props) {
  const available = UPGRADES.filter((u) => !state.upgrades.includes(u.id));
  if (available.length === 0) return null;

  return (
    <div className="upgrade-panel">
      <h3>upgrades</h3>
      <div className="upgrade-grid">
        {available.map((u) => {
          const canAfford =
            u.currency === "tokens" ? state.tokens >= u.cost : state.funding >= u.cost;
          return (
            <button
              key={u.id}
              className={`upgrade-btn ${canAfford ? "affordable" : "expensive"}`}
              disabled={!canAfford}
              onClick={() => onBuy(u.id)}
              title={u.description}
            >
              <span className="upgrade-name">{u.name}</span>
              <span className="upgrade-cost">
                {fmt(u.cost)} {u.currency === "tokens" ? "T" : "$"}
              </span>
              <span className="upgrade-desc">{u.description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
