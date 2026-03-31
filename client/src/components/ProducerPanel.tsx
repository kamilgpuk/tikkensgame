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

// Returns a hint string for locked items, or null if unlocked
function hardwareUnlockHint(id: HardwareId, state: GameState): string | null {
  const cond = HARDWARE_MAP[id].unlockCondition;
  if (cond.type === "start") return null;
  if (cond.type === "ownHardware") {
    const have = state.hardware[cond.id];
    const need = cond.qty;
    const hwName = HARDWARE_MAP[cond.id].name;
    return have >= need ? null : `unlock: own ${need}× ${hwName} (${have}/${need})`;
  }
  return null;
}

function modelUnlockHint(id: ModelId, state: GameState): string | null {
  const cond = MODEL_MAP[id].unlockCondition;
  if (cond.type === "start") return null;
  if (cond.type === "ownHardware") {
    const have = state.hardware[cond.id];
    const hwName = HARDWARE_MAP[cond.id].name;
    return have >= cond.qty ? null : `unlock: own ${cond.qty}× ${hwName} (${have}/${cond.qty})`;
  }
  if (cond.type === "ownHardwareAndPrestige") {
    const parts = [];
    if (state.hardware[cond.id] < cond.qty) {
      parts.push(`${cond.qty}× ${HARDWARE_MAP[cond.id].name}`);
    }
    if (state.prestigeCount < cond.prestiges) {
      parts.push(`${cond.prestiges} prestiges`);
    }
    return parts.length > 0 ? `unlock: ${parts.join(" + ")}` : null;
  }
  return null;
}

function investorUnlockHint(id: InvestorId, state: GameState): string | null {
  const min = INVESTOR_MAP[id].unlockCondition.min;
  return state.hype >= min ? null : `unlock: hype ≥ ${min} (now ${state.hype.toFixed(1)})`;
}

// Show locked items that are one tier away (next unlock)
function isNextHardware(id: HardwareId, state: GameState): boolean {
  const cond = HARDWARE_MAP[id].unlockCondition;
  if (cond.type === "ownHardware") {
    const have = state.hardware[cond.id];
    return have > 0 && have < cond.qty;
  }
  return false;
}

interface RowProps {
  name: string;
  owned: number;
  cost: number;
  canAfford: boolean;
  detail: string;
  unlockHint: string | null;
  isLocked: boolean;
  isClose: boolean;
  onBuy: () => void;
}

function ProducerRow({ name, owned, cost, canAfford, detail, unlockHint, isLocked, isClose, onBuy }: RowProps) {
  if (isLocked && !isClose) return null;

  return (
    <div className={`producer-row ${isLocked ? "locked" : canAfford ? "affordable" : "expensive"}`}>
      <div className="producer-info">
        <span className="producer-name">{name}</span>
        {isLocked && unlockHint
          ? <span className="unlock-hint">{unlockHint}</span>
          : <span className="producer-detail">{detail}</span>
        }
      </div>
      {!isLocked && (
        <div className="producer-right">
          {owned > 0 && <span className="producer-owned">×{owned}</span>}
          <button className="buy-btn" disabled={!canAfford} onClick={onBuy}>
            {fmt(cost)} T
          </button>
        </div>
      )}
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
        {HARDWARE.map((h) => {
          const unlocked = isHardwareUnlocked(h.id, state);
          const hint = hardwareUnlockHint(h.id, state);
          const close = !unlocked && isNextHardware(h.id, state);
          return (
            <ProducerRow
              key={h.id}
              name={h.name}
              owned={state.hardware[h.id]}
              cost={scaledCost(h.baseCost, state.hardware[h.id])}
              canAfford={state.tokens >= scaledCost(h.baseCost, state.hardware[h.id])}
              detail={`+${h.computePerSec} compute/s`}
              unlockHint={hint}
              isLocked={!unlocked}
              isClose={close}
              onBuy={() => onBuy("hardware", h.id)}
            />
          );
        })}
      </section>

      <section>
        <h3>models</h3>
        {MODELS.map((m) => {
          const unlocked = isModelUnlocked(m.id, state);
          const hint = modelUnlockHint(m.id, state);
          // Show locked model if it's the next one up
          const unlockedModels = MODELS.filter((x) => isModelUnlocked(x.id, state));
          const lastUnlockedIdx = MODELS.findIndex((x) => x.id === (unlockedModels[unlockedModels.length - 1]?.id));
          const myIdx = MODELS.findIndex((x) => x.id === m.id);
          const isNext = !unlocked && myIdx === lastUnlockedIdx + 1;
          return (
            <ProducerRow
              key={m.id}
              name={m.name}
              owned={state.models[m.id]}
              cost={scaledCost(m.baseCost, state.models[m.id])}
              canAfford={state.tokens >= scaledCost(m.baseCost, state.models[m.id])}
              detail={`+${fmt(m.tokensPerSec)} T/s · −${m.computePerSec} C/s`}
              unlockHint={hint}
              isLocked={!unlocked}
              isClose={isNext}
              onBuy={() => onBuy("model", m.id)}
            />
          );
        })}
      </section>

      {(INVESTORS.some((i) => isInvestorUnlocked(i.id, state)) || state.hype > 0) && (
        <section>
          <h3>investors</h3>
          {INVESTORS.map((i) => {
            const unlocked = isInvestorUnlocked(i.id, state);
            const hint = investorUnlockHint(i.id, state);
            const unlockedInv = INVESTORS.filter((x) => isInvestorUnlocked(x.id, state));
            const lastIdx = INVESTORS.findIndex((x) => x.id === (unlockedInv[unlockedInv.length - 1]?.id));
            const myIdx = INVESTORS.findIndex((x) => x.id === i.id);
            const isNext = !unlocked && myIdx === lastIdx + 1;
            return (
              <ProducerRow
                key={i.id}
                name={i.name}
                owned={state.investors[i.id]}
                cost={scaledCost(i.baseCost, state.investors[i.id])}
                canAfford={state.tokens >= scaledCost(i.baseCost, state.investors[i.id])}
                detail={`+$${i.fundingPerSec}/s funding`}
                unlockHint={hint}
                isLocked={!unlocked}
                isClose={isNext}
                onBuy={() => onBuy("investor", i.id)}
              />
            );
          })}
        </section>
      )}
    </div>
  );
}
