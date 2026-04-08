import type { GameState } from "@ai-hype/shared";
import Decimal from "break_eternity.js";
import {
  HARDWARE,
  MODELS,
  INVESTORS,
  HARDWARE_MAP,
  MODEL_MAP,
  INVESTOR_MAP,
  modelNextInstanceComputeCost,
} from "@ai-hype/shared";
import type { HardwareId, ModelId, InvestorId } from "@ai-hype/shared";
import { fmt } from "../lib/format.js";

function scaledCost(baseCost: number, owned: number, costScale: number): Decimal {
  return new Decimal(baseCost).mul(Decimal.pow(costScale, owned));
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

/**
 * Estimate how many hardware units of a given type are offline due to funding deficit.
 * Uses state.funding (balance) against per-second running cost (elapsed=1 approximation).
 */
function computeHardwareOffline(state: GameState): Record<HardwareId, number> {
  const fundingBalance = state.funding.toNumber();

  const active: Record<HardwareId, number> = { ...state.hardware };
  let totalRunningCostPerSec = 0;
  for (const hw of HARDWARE) {
    if (hw.fundingRunningCost > 0) {
      totalRunningCostPerSec += active[hw.id] * hw.fundingRunningCost;
    }
  }

  if (fundingBalance >= totalRunningCostPerSec) {
    // All online — offline count is 0
    const offline: Record<HardwareId, number> = {} as Record<HardwareId, number>;
    for (const hw of HARDWARE) offline[hw.id] = 0;
    return offline;
  }

  const expensiveFirst = HARDWARE
    .filter(hw => hw.fundingRunningCost > 0)
    .sort((a, b) => b.fundingRunningCost - a.fundingRunningCost);

  for (const hw of expensiveFirst) {
    while (active[hw.id] > 0 && totalRunningCostPerSec > fundingBalance) {
      active[hw.id]--;
      totalRunningCostPerSec -= hw.fundingRunningCost;
    }
  }

  const offline: Record<HardwareId, number> = {} as Record<HardwareId, number>;
  for (const hw of HARDWARE) {
    offline[hw.id] = state.hardware[hw.id] - active[hw.id];
  }
  return offline;
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
  offlineCount?: number;
  onBuy: () => void;
}

function ProducerRow({ name, owned, cost, canAfford, detail, unlockHint, isLocked, isClose, offlineCount, onBuy }: RowProps) {
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
          {owned > 0 && (
            <span className="producer-owned">
              ×{owned}
              {offlineCount != null && offlineCount > 0 && (
                <span className="offline-badge"> [{offlineCount} offline]</span>
              )}
            </span>
          )}
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
  const offlineByHw = computeHardwareOffline(state);

  return (
    <div className="producer-panel">
      <section>
        <h3>hardware</h3>
        {HARDWARE.map((h) => {
          const unlocked = isHardwareUnlocked(h.id, state);
          const hint = hardwareUnlockHint(h.id, state);
          const close = !unlocked && isNextHardware(h.id, state);
          const offlineCount = offlineByHw[h.id];
          const detail = h.fundingRunningCost > 0
            ? `▶ ${h.computePerSec} compute/s · 💸 ${h.fundingRunningCost} funding/s`
            : `▶ ${h.computePerSec} compute/s`;
          return (
            <ProducerRow
              key={h.id}
              name={h.name}
              owned={state.hardware[h.id]}
              cost={scaledCost(h.baseCost, state.hardware[h.id], h.costScale).toNumber()}
              canAfford={state.tokens.gte(scaledCost(h.baseCost, state.hardware[h.id], h.costScale))}
              detail={detail}
              unlockHint={hint}
              isLocked={!unlocked}
              isClose={close}
              offlineCount={offlineCount}
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
          const nextComputeCost = modelNextInstanceComputeCost(m.computePerSec, state.models[m.id]);
          const detail = `+${fmt(m.tokensPerSec)} T/s · ⚡ ${nextComputeCost.toFixed(2)} C/s (next)`;
          return (
            <ProducerRow
              key={m.id}
              name={m.name}
              owned={state.models[m.id]}
              cost={scaledCost(m.baseCost, state.models[m.id], m.costScale).toNumber()}
              canAfford={state.tokens.gte(scaledCost(m.baseCost, state.models[m.id], m.costScale))}
              detail={detail}
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
                cost={scaledCost(i.baseCost, state.investors[i.id], i.costScale).toNumber()}
                canAfford={state.tokens.gte(scaledCost(i.baseCost, state.investors[i.id], i.costScale))}
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
