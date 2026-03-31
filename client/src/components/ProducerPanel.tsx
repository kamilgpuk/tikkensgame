import type { GameState } from "@ai-hype/shared";
import {
  HARDWARE,
  MODELS,
  INVESTORS,
  HARDWARE_MAP,
  MODEL_MAP,
  INVESTOR_MAP,
} from "@ai-hype/shared";
import type { HardwareId, ModelId, InvestorId } from "@ai-hype/shared";
import { fmt } from "../lib/format.js";

// Inline cost scaling (mirrors engine)
function scaledCost(baseCost: number, owned: number): number {
  return baseCost * Math.pow(1.15, owned);
}

function isHardwareUnlocked(id: HardwareId, state: GameState): boolean {
  const cond = HARDWARE_MAP[id].unlockCondition;
  if (cond.type === "start") return true;
  if (cond.type === "ownHardware") return state.hardware[cond.id] >= cond.qty;
  return false;
}

function isModelUnlocked(id: ModelId, state: GameState): boolean {
  const cond = MODEL_MAP[id].unlockCondition;
  if (cond.type === "start") return true;
  if (cond.type === "ownHardware") return state.hardware[cond.id] >= cond.qty;
  if (cond.type === "ownHardwareAndPrestige")
    return state.hardware[cond.id] >= cond.qty && state.prestigeCount >= cond.prestiges;
  return false;
}

function isInvestorUnlocked(id: InvestorId, state: GameState): boolean {
  return state.hype >= INVESTOR_MAP[id].unlockCondition.min;
}

interface RowProps {
  name: string;
  owned: number;
  cost: number;
  canAfford: boolean;
  detail: string;
  onBuy: () => void;
}

function ProducerRow({ name, owned, cost, canAfford, detail, onBuy }: RowProps) {
  return (
    <div className={`producer-row ${canAfford ? "affordable" : "expensive"}`}>
      <div className="producer-info">
        <span className="producer-name">{name}</span>
        <span className="producer-detail">{detail}</span>
      </div>
      <div className="producer-right">
        {owned > 0 && <span className="producer-owned">×{owned}</span>}
        <button
          className="buy-btn"
          disabled={!canAfford}
          onClick={onBuy}
        >
          {fmt(cost)} T
        </button>
      </div>
    </div>
  );
}

interface Props {
  state: GameState;
  onBuy: (type: string, id: string) => void;
}

export function ProducerPanel({ state, onBuy }: Props) {
  return (
    <div className="producer-panel">
      <section>
        <h3>hardware</h3>
        {HARDWARE.filter((h) => isHardwareUnlocked(h.id, state)).map((h) => (
          <ProducerRow
            key={h.id}
            name={h.name}
            owned={state.hardware[h.id]}
            cost={scaledCost(h.baseCost, state.hardware[h.id])}
            canAfford={state.tokens >= scaledCost(h.baseCost, state.hardware[h.id])}
            detail={`+${h.computePerSec} compute/s`}
            onBuy={() => onBuy("hardware", h.id)}
          />
        ))}
      </section>

      <section>
        <h3>models</h3>
        {MODELS.filter((m) => isModelUnlocked(m.id, state)).map((m) => (
          <ProducerRow
            key={m.id}
            name={m.name}
            owned={state.models[m.id]}
            cost={scaledCost(m.baseCost, state.models[m.id])}
            canAfford={state.tokens >= scaledCost(m.baseCost, state.models[m.id])}
            detail={`+${fmt(m.tokensPerSec)} T/s · −${m.computePerSec} C/s`}
            onBuy={() => onBuy("model", m.id)}
          />
        ))}
      </section>

      {INVESTORS.some((i) => isInvestorUnlocked(i.id, state)) && (
        <section>
          <h3>investors</h3>
          {INVESTORS.filter((i) => isInvestorUnlocked(i.id, state)).map((i) => (
            <ProducerRow
              key={i.id}
              name={i.name}
              owned={state.investors[i.id]}
              cost={scaledCost(i.baseCost, state.investors[i.id])}
              canAfford={state.tokens >= scaledCost(i.baseCost, state.investors[i.id])}
              detail={`+$${i.fundingPerSec}/s funding`}
              onBuy={() => onBuy("investor", i.id)}
            />
          ))}
        </section>
      )}
    </div>
  );
}
