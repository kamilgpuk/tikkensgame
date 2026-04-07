import Decimal from "break_eternity.js";
import {
  GameState,
  HardwareId,
  ModelId,
  InvestorId,
  UpgradeId,
  MilestoneId,
  ActionOption,
  HARDWARE,
  HARDWARE_MAP,
  MODELS,
  MODEL_MAP,
  INVESTORS,
  INVESTOR_MAP,
  UPGRADES,
  UPGRADE_MAP,
  MILESTONES,
  prestigeTokenThreshold,
  prestigeFundingThreshold,
  reputationMultiplier,
  computeTokenCap,
  computeComputeCap,
  modelTotalComputeCost,
  modelNextInstanceComputeCost,
} from "@ai-hype/shared";

// ─── Initial state ────────────────────────────────────────────────────────────

const D0 = new Decimal(0);

export function createInitialState(playerId: string, playerName: string): GameState {
  return {
    playerId,
    playerName,
    tokens: D0,
    compute: D0,
    hype: 0,
    funding: D0,
    totalTokensEarned: D0,
    totalClicks: 0,
    prestigeCount: 0,
    reputation: 0,
    tokensPerSecond: D0,
    computePerSecond: D0,
    fundingPerSecond: D0,
    clickPower: new Decimal(1),
    tokenCap: 1_000,
    computeCap: 50,
    hardware: {
      mac_mini: 0, gaming_pc: 0, a100: 0, tpu_pod: 0,
      gpu_cluster: 0, data_center: 0, hyperscaler: 0,
    },
    models: {
      gpt2: 0, llama7b: 0, mistral7b: 0, llama70b: 0,
      claude_haiku: 0, gpt4: 0, agi: 0,
    },
    investors: {
      moms_card: 0, angel: 0, seed: 0,
      series_a: 0, softbank: 0, saudi_fund: 0,
    },
    upgrades: [],
    milestonesHit: [],
    updatedAt: Date.now(),
  };
}

// ─── Multiplier helpers ───────────────────────────────────────────────────────

/**
 * Per-model token multiplier. Upgrades with modelMultiplier stack additively:
 * m = 1 + Σ(factor - 1) for each applicable upgrade.
 */
export function getModelTokenMultiplier(state: GameState, modelId: ModelId): number {
  let m = 1;
  for (const id of state.upgrades) {
    const def = UPGRADE_MAP[id];
    if (def.effect.type === "modelMultiplier") {
      const { modelIds } = def.effect;
      if (!modelIds || modelIds.includes(modelId)) {
        m += def.effect.factor - 1; // additive stacking
      }
    }
  }
  return m;
}

/**
 * Per-model compute cost multiplier. Upgrades with modelComputeMultiplier stack multiplicatively.
 */
export function getModelComputeCostMultiplier(state: GameState, modelId: ModelId): number {
  let m = 1;
  for (const id of state.upgrades) {
    const def = UPGRADE_MAP[id];
    if (def.effect.type === "modelComputeMultiplier") {
      const { modelIds } = def.effect;
      if (!modelIds || modelIds.includes(modelId)) {
        m *= def.effect.factor; // multiplicative stacking
      }
    }
  }
  return m;
}

/**
 * Investor funding multiplier. Upgrades with investorMultiplier stack additively.
 */
export function getInvestorMultiplier(state: GameState): number {
  let m = 1;
  for (const id of state.upgrades) {
    const def = UPGRADE_MAP[id];
    if (def.effect.type === "investorMultiplier") {
      m += def.effect.factor - 1; // additive stacking
    }
  }
  return m;
}

function getHardwareMultiplier(state: GameState): number {
  let m = 1;
  for (const id of state.upgrades) {
    const def = UPGRADE_MAP[id];
    if (def.effect.type === "hardwareMultiplier") {
      m *= def.effect.factor;
    }
  }
  return m;
}

function getHypeMilestoneMultiplier(state: GameState): number {
  let m = 1;
  for (const id of state.upgrades) {
    const def = UPGRADE_MAP[id];
    if (def.effect.type === "hypeMilestoneMultiplier") m *= def.effect.factor;
  }
  return m;
}

function getHypeMultiplier(state: GameState): number {
  let m = 1;
  for (const id of state.upgrades) {
    const def = UPGRADE_MAP[id];
    if (def.effect.type === "hypeMultiplier") m *= def.effect.factor;
  }
  return m;
}

// ─── Offline resolution helpers ───────────────────────────────────────────────

/**
 * Returns active hardware counts after funding-based offline logic.
 * Most expensive hardware (by fundingRunningCost) goes offline first when budget is insufficient.
 */
export function resolveActiveHardware(
  state: GameState,
  fundingPerSec: number
): Record<HardwareId, number> {
  const active: Record<HardwareId, number> = { ...state.hardware };

  let totalFundingNeeded = 0;
  for (const hw of HARDWARE) {
    if (hw.fundingRunningCost > 0) {
      totalFundingNeeded += active[hw.id] * hw.fundingRunningCost;
    }
  }

  if (fundingPerSec >= totalFundingNeeded) return active;

  // Sort by cost DESC, take units offline one by one until budget balances
  const expensiveFirst = HARDWARE
    .filter(hw => hw.fundingRunningCost > 0)
    .sort((a, b) => b.fundingRunningCost - a.fundingRunningCost);

  for (const hw of expensiveFirst) {
    while (active[hw.id] > 0 && totalFundingNeeded > fundingPerSec) {
      active[hw.id]--;
      totalFundingNeeded -= hw.fundingRunningCost;
    }
  }

  return active;
}

/**
 * Returns active model instance counts after compute-based offline logic.
 * Most compute-expensive instances go offline first when compute is insufficient.
 * Uses an efficient approach: for each model type, binary-search for max active count.
 */
export function resolveActiveModels(
  state: GameState,
  computeAvailable: number,
  upgrades: GameState["upgrades"]
): Record<ModelId, number> {
  if (computeAvailable <= 0) {
    // No compute — all models offline
    const zero: Record<ModelId, number> = {} as Record<ModelId, number>;
    for (const m of MODELS) zero[m.id] = 0;
    return zero;
  }

  // Build a list of all model types sorted by their per-instance cost DESC
  // (most expensive model type gets cut first)
  const modelsByExpense = [...MODELS].sort((a, b) => {
    const costA = getModelComputeCostMultiplier({ ...state, upgrades }, a.id) * a.computePerSec;
    const costB = getModelComputeCostMultiplier({ ...state, upgrades }, b.id) * b.computePerSec;
    return costB - costA;
  });

  // First pass: compute total needed
  let totalNeeded = 0;
  const costMults: Record<ModelId, number> = {} as Record<ModelId, number>;
  for (const model of MODELS) {
    costMults[model.id] = getModelComputeCostMultiplier({ ...state, upgrades }, model.id);
    totalNeeded += modelTotalComputeCost(model.computePerSec, state.models[model.id], costMults[model.id]);
  }

  if (computeAvailable >= totalNeeded) {
    return { ...state.models };
  }

  // Greedily reduce: take the most expensive model type offline first (binary search per type)
  // Budget starts at computeAvailable; we allocate as much as possible to cheaper models first
  const active: Record<ModelId, number> = {} as Record<ModelId, number>;
  for (const m of MODELS) active[m.id] = state.models[m.id];

  let remaining = computeAvailable;

  // For each model type (most expensive first), binary-search how many can run
  for (const model of modelsByExpense) {
    const owned = active[model.id];
    if (owned === 0) continue;

    const costMult = costMults[model.id];
    const fullCost = modelTotalComputeCost(model.computePerSec, owned, costMult);

    if (fullCost <= remaining) {
      // All can run
      remaining -= fullCost;
    } else if (remaining <= 0) {
      active[model.id] = 0;
    } else {
      // Binary search: find max k such that modelTotalComputeCost(base, k, mult) <= remaining
      let lo = 0;
      let hi = owned;
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        const cost = modelTotalComputeCost(model.computePerSec, mid, costMult);
        if (cost <= remaining) {
          lo = mid;
        } else {
          hi = mid - 1;
        }
      }
      const cost = modelTotalComputeCost(model.computePerSec, lo, costMult);
      active[model.id] = lo;
      remaining -= cost;
    }
  }

  return active;
}

// ─── Rate computation ─────────────────────────────────────────────────────────

export function computeRates(state: GameState): {
  computePerSecond: Decimal;
  rawTokensPerSecond: Decimal; // before hype
  tokensPerSecond: Decimal;
  fundingPerSecond: Decimal;
  clickPower: Decimal;
} {
  const hwMult = getHardwareMultiplier(state);
  const hypeMult = getHypeMultiplier(state);

  // ── Funding/s (needed for hardware offline check) ──
  const invMult = getInvestorMultiplier(state);
  let rawFunding = 0;
  for (const inv of INVESTORS) {
    rawFunding += inv.fundingPerSec * state.investors[inv.id] * invMult;
  }
  const fundingPerSecond = new Decimal(rawFunding);

  // ── Resolve active hardware (funding-based offline) ──
  const activeHardware = resolveActiveHardware(state, rawFunding);

  // Compute generated by active hardware
  let computeGenerated = 0;
  for (const hw of HARDWARE) {
    computeGenerated += hw.computePerSec * activeHardware[hw.id] * hwMult;
  }

  // Current compute available for models
  const computeAvailable = Math.max(0, state.compute.toNumber() + computeGenerated);

  // ── Resolve active models (compute-based offline) ──
  const activeModels = resolveActiveModels(state, computeAvailable, state.upgrades);

  // Compute actually consumed by active models
  let computeConsumed = 0;
  for (const model of MODELS) {
    if (activeModels[model.id] > 0) {
      const costMult = getModelComputeCostMultiplier(state, model.id);
      computeConsumed += modelTotalComputeCost(model.computePerSec, activeModels[model.id], costMult);
    }
  }

  const computePerSecond = new Decimal(computeGenerated - computeConsumed);

  // Raw tokens/s (before hype/reputation)
  let rawTokens = D0;
  for (const model of MODELS) {
    if (activeModels[model.id] > 0) {
      const tokenMult = getModelTokenMultiplier(state, model.id);
      rawTokens = rawTokens.add(
        new Decimal(model.tokensPerSec * activeModels[model.id] * tokenMult)
      );
    }
  }

  // Reputation bonus
  const reputationBonus = reputationMultiplier(state.reputation);

  // Hype token multiplier (Stage 7: scaled by k=0.05)
  const HYPE_SCALE = 0.05;
  const hypeBonus = 1 + state.hype * HYPE_SCALE * hypeMult;

  const tokensPerSecond = rawTokens.mul(reputationBonus).mul(hypeBonus);

  // Click power — base reputation multiplier (no click upgrades in new system)
  const clickPower = new Decimal(reputationBonus);

  return { computePerSecond, rawTokensPerSecond: rawTokens, tokensPerSecond, fundingPerSecond, clickPower };
}

// ─── Cost helpers ─────────────────────────────────────────────────────────────

export function producerCost(baseCost: number, owned: number, scale: number, quantity = 1): Decimal {
  // Sum of geometric series: base × scale^owned × (scale^qty - 1) / (scale - 1)
  if (quantity === 1) {
    return new Decimal(baseCost).mul(Decimal.pow(scale, owned));
  }
  return new Decimal(baseCost)
    .mul(Decimal.pow(scale, owned))
    .mul(Decimal.pow(scale, quantity).sub(1).div(scale - 1));
}

// ─── Unlock checks ────────────────────────────────────────────────────────────

export function isHardwareUnlocked(id: HardwareId, state: GameState): boolean {
  const def = HARDWARE_MAP[id];
  const cond = def.unlockCondition;
  if (cond.type === "start") return true;
  if (cond.type === "ownHardware") return state.hardware[cond.id] >= cond.qty;
  return false;
}

export function isModelUnlocked(id: ModelId, state: GameState): boolean {
  const def = MODEL_MAP[id];
  const cond = def.unlockCondition;
  if (cond.type === "start") return true;
  if (cond.type === "ownHardware") return state.hardware[cond.id] >= cond.qty;
  if (cond.type === "ownHardwareAndPrestige") {
    return state.hardware[cond.id] >= cond.qty && state.prestigeCount >= cond.prestiges;
  }
  return false;
}

export function isInvestorUnlocked(id: InvestorId, state: GameState): boolean {
  const def = INVESTOR_MAP[id];
  return state.hype >= def.unlockCondition.min;
}

// ─── Tick ─────────────────────────────────────────────────────────────────────

export interface TickResult {
  state: GameState;
  newMilestones: MilestoneId[];
}

export function tick(state: GameState, elapsedMs: number): TickResult {
  const elapsed = elapsedMs / 1000;
  const rates = computeRates(state);

  const newTokens = rates.tokensPerSecond.mul(elapsed);
  const newCompute = rates.computePerSecond.mul(elapsed);
  const newFunding = rates.fundingPerSecond.mul(elapsed);

  // Compute caps
  const tokenCap = computeTokenCap(state);
  const computeCap = computeComputeCap(state);

  const tokens = Decimal.min(
    new Decimal(tokenCap),
    Decimal.max(D0, state.tokens.add(newTokens))
  );
  const compute = Decimal.min(
    new Decimal(computeCap),
    Decimal.max(D0, state.compute.add(newCompute))
  );
  const funding = state.funding.add(newFunding);
  const newTokensClamped = Decimal.max(D0, newTokens);
  const totalTokensEarned = state.totalTokensEarned.add(newTokensClamped);

  // Check milestones
  const newMilestones: MilestoneId[] = [];
  let hype = state.hype;
  const milestonesHit = [...state.milestonesHit];
  const hypeMilestoneMult = getHypeMilestoneMultiplier(state);

  for (const milestone of MILESTONES) {
    if (
      !milestonesHit.includes(milestone.id) &&
      totalTokensEarned.gte(milestone.totalTokensRequired)
    ) {
      milestonesHit.push(milestone.id);
      newMilestones.push(milestone.id);
      hype += milestone.hypeGain * hypeMilestoneMult;
    }
  }

  const updated: GameState = {
    ...state,
    tokens,
    compute,
    funding,
    hype,
    totalTokensEarned,
    tokenCap,
    computeCap,
    milestonesHit,
    tokensPerSecond: rates.tokensPerSecond,
    computePerSecond: rates.computePerSecond,
    fundingPerSecond: rates.fundingPerSecond,
    clickPower: rates.clickPower,
    updatedAt: state.updatedAt + elapsedMs,
  };

  return { state: updated, newMilestones };
}

// ─── Click ────────────────────────────────────────────────────────────────────

export function click(state: GameState, n = 1): GameState {
  const rates = computeRates(state);
  const gained = rates.clickPower.mul(n);
  // Tokens from clicks are not capped (same as before; caps apply to passive accumulation)
  return {
    ...state,
    tokens: state.tokens.add(gained),
    totalTokensEarned: state.totalTokensEarned.add(gained),
    totalClicks: state.totalClicks + n,
    clickPower: rates.clickPower,
  };
}

// ─── Buy producer ─────────────────────────────────────────────────────────────

export type BuyResult = { ok: true; state: GameState } | { ok: false; error: string };

export function buyHardware(state: GameState, id: HardwareId, qty = 1): BuyResult {
  if (!isHardwareUnlocked(id, state)) return { ok: false, error: "Not unlocked" };
  const def = HARDWARE_MAP[id];
  const cost = producerCost(def.baseCost, state.hardware[id], def.costScale, qty);
  if (state.tokens.lt(cost)) return { ok: false, error: "Not enough tokens" };
  const hardware = { ...state.hardware, [id]: state.hardware[id] + qty };
  const newState = { ...state, hardware };
  const rates = computeRates(newState);
  return {
    ok: true,
    state: {
      ...newState,
      tokens: state.tokens.sub(cost),
      tokenCap: computeTokenCap(newState),
      computeCap: computeComputeCap(newState),
      tokensPerSecond: rates.tokensPerSecond,
      computePerSecond: rates.computePerSecond,
      fundingPerSecond: rates.fundingPerSecond,
      clickPower: rates.clickPower,
    },
  };
}

export function buyModel(state: GameState, id: ModelId, qty = 1): BuyResult {
  if (!isModelUnlocked(id, state)) return { ok: false, error: "Not unlocked" };
  const def = MODEL_MAP[id];
  const cost = producerCost(def.baseCost, state.models[id], def.costScale, qty);
  if (state.tokens.lt(cost)) return { ok: false, error: "Not enough tokens" };
  const models = { ...state.models, [id]: state.models[id] + qty };
  const newState = { ...state, models };
  const rates = computeRates(newState);
  return {
    ok: true,
    state: {
      ...newState,
      tokens: state.tokens.sub(cost),
      tokenCap: computeTokenCap(newState),
      tokensPerSecond: rates.tokensPerSecond,
      computePerSecond: rates.computePerSecond,
      fundingPerSecond: rates.fundingPerSecond,
      clickPower: rates.clickPower,
    },
  };
}

export function buyInvestor(state: GameState, id: InvestorId, qty = 1): BuyResult {
  if (!isInvestorUnlocked(id, state)) return { ok: false, error: "Not unlocked" };
  const def = INVESTOR_MAP[id];
  const cost = producerCost(def.baseCost, state.investors[id], def.costScale, qty);
  if (state.tokens.lt(cost)) return { ok: false, error: "Not enough tokens" };
  const investors = { ...state.investors, [id]: state.investors[id] + qty };
  const rates = computeRates({ ...state, investors });
  return {
    ok: true,
    state: {
      ...state,
      tokens: state.tokens.sub(cost),
      investors,
      tokensPerSecond: rates.tokensPerSecond,
      computePerSecond: rates.computePerSecond,
      fundingPerSecond: rates.fundingPerSecond,
      clickPower: rates.clickPower,
    },
  };
}

export function buyUpgrade(state: GameState, id: UpgradeId): BuyResult {
  if (state.upgrades.includes(id)) return { ok: false, error: "Already purchased" };
  const def = UPGRADE_MAP[id];
  if (def.currency === "tokens" && state.tokens.lt(def.cost)) {
    return { ok: false, error: "Not enough tokens" };
  }
  if (def.currency === "funding" && state.funding.lt(def.cost)) {
    return { ok: false, error: "Not enough funding" };
  }
  const upgrades = [...state.upgrades, id];
  const newState = {
    ...state,
    tokens: def.currency === "tokens" ? state.tokens.sub(def.cost) : state.tokens,
    funding: def.currency === "funding" ? state.funding.sub(def.cost) : state.funding,
    upgrades,
  };
  const rates = computeRates(newState);
  return {
    ok: true,
    state: {
      ...newState,
      tokensPerSecond: rates.tokensPerSecond,
      computePerSecond: rates.computePerSecond,
      fundingPerSecond: rates.fundingPerSecond,
      clickPower: rates.clickPower,
    },
  };
}

// ─── Prestige ─────────────────────────────────────────────────────────────────

export function prestige(state: GameState): BuyResult {
  const tokenGoal = prestigeTokenThreshold(state.prestigeCount);
  const fundingGoal = prestigeFundingThreshold(state.prestigeCount);
  if (state.totalTokensEarned.lt(tokenGoal)) {
    return { ok: false, error: `Need ${tokenGoal.toNumber().toLocaleString()} total tokens earned` };
  }
  if (state.funding.lt(fundingGoal)) {
    return { ok: false, error: `Need ${fundingGoal.toNumber().toLocaleString()} funding` };
  }

  const reputationGain = Math.floor(
    Math.log10(Math.max(1, state.totalTokensEarned.toNumber()))
  );
  const reputation = state.reputation + reputationGain;
  const prestigeCount = state.prestigeCount + 1;

  const fresh = createInitialState(state.playerId, state.playerName);
  return {
    ok: true,
    state: {
      ...fresh,
      reputation,
      prestigeCount,
      hype: state.hype * 0.1,
      updatedAt: Date.now(),
    },
  };
}

// ─── Available actions (for MCP ROI) ─────────────────────────────────────────

export function getAvailableActions(state: GameState): ActionOption[] {
  const actions: ActionOption[] = [];
  const rates = computeRates(state);
  const rawFunding = rates.fundingPerSecond.toNumber();
  const activeHardware = resolveActiveHardware(state, rawFunding);

  for (const hw of HARDWARE) {
    if (!isHardwareUnlocked(hw.id, state)) continue;
    const cost = producerCost(hw.baseCost, state.hardware[hw.id], hw.costScale);
    const offlineCount = state.hardware[hw.id] - activeHardware[hw.id];
    actions.push({
      type: "hardware",
      id: hw.id,
      name: hw.name,
      cost: cost.toNumber(),
      currency: "tokens",
      affordable: state.tokens.gte(cost),
      tokensPerSecGain: 0,
      paybackSeconds: null,
      unlocksNew: checkHardwareUnlocks(hw.id, state),
      computePerSecGain: hw.computePerSec,
      fundingRunningCost: hw.fundingRunningCost,
      isOnline: offlineCount < state.hardware[hw.id] || state.hardware[hw.id] === 0,
      offlineUnitsCount: offlineCount,
    });
  }

  for (const model of MODELS) {
    if (!isModelUnlocked(model.id, state)) continue;
    const cost = producerCost(model.baseCost, state.models[model.id], model.costScale);
    const costMult = getModelComputeCostMultiplier(state, model.id);
    const tokenMult = getModelTokenMultiplier(state, model.id);
    const HYPE_SCALE = 0.05;
    const hypeBonus = 1 + state.hype * HYPE_SCALE * getHypeMultiplier(state);
    const reputationBonus = reputationMultiplier(state.reputation);
    const tokensPerSecGain = model.tokensPerSec * tokenMult * hypeBonus * reputationBonus;
    const paybackSeconds = tokensPerSecGain > 0 ? cost.toNumber() / tokensPerSecGain : null;
    const nextComputeCost = modelNextInstanceComputeCost(model.computePerSec, state.models[model.id], costMult);
    const totalCompute = modelTotalComputeCost(model.computePerSec, state.models[model.id], costMult);
    actions.push({
      type: "model",
      id: model.id,
      name: model.name,
      cost: cost.toNumber(),
      currency: "tokens",
      affordable: state.tokens.gte(cost),
      tokensPerSecGain,
      paybackSeconds,
      unlocksNew: false,
      nextInstanceComputeCost: nextComputeCost,
      totalComputeConsumed: totalCompute,
    });
  }

  for (const inv of INVESTORS) {
    if (!isInvestorUnlocked(inv.id, state)) continue;
    const cost = producerCost(inv.baseCost, state.investors[inv.id], inv.costScale);
    actions.push({
      type: "investor",
      id: inv.id,
      name: inv.name,
      cost: cost.toNumber(),
      currency: "tokens",
      affordable: state.tokens.gte(cost),
      tokensPerSecGain: 0,
      paybackSeconds: null,
      unlocksNew: false,
      fundingRunningCost: 0,
    });
  }

  for (const upg of UPGRADES) {
    if (state.upgrades.includes(upg.id)) continue;
    const affordable =
      upg.currency === "tokens" ? state.tokens.gte(upg.cost) : state.funding.gte(upg.cost);
    actions.push({
      type: "upgrade",
      id: upg.id,
      name: upg.name,
      cost: upg.cost,
      currency: upg.currency,
      affordable,
      tokensPerSecGain: estimateUpgradeGain(upg.id, state, rates.tokensPerSecond),
      paybackSeconds: null,
      unlocksNew: false,
    });
  }

  // Add prestige if eligible
  const tokenThreshold = prestigeTokenThreshold(state.prestigeCount);
  const fundingThreshold = prestigeFundingThreshold(state.prestigeCount);
  const prestigeEligible =
    state.totalTokensEarned.gte(tokenThreshold) && state.funding.gte(fundingThreshold);
  const reputationGain = Math.floor(
    Math.log10(Math.max(1, state.totalTokensEarned.toNumber()))
  );
  const newReputation = state.reputation + reputationGain;
  const newMultiplier = 1 + Math.sqrt(newReputation) * 1.5;
  actions.push({
    type: "prestige",
    id: "prestige",
    name: "Go IPO",
    cost: fundingThreshold.toNumber(),
    currency: "funding",
    affordable: prestigeEligible,
    tokensPerSecGain: 0,
    paybackSeconds: null,
    unlocksNew: true,
    reputationGain,
    newMultiplier,
  });

  return actions.sort((a, b) => {
    if (a.affordable && !b.affordable) return -1;
    if (!a.affordable && b.affordable) return 1;
    if (a.paybackSeconds !== null && b.paybackSeconds !== null) {
      return a.paybackSeconds - b.paybackSeconds;
    }
    return 0;
  });
}

function checkHardwareUnlocks(id: HardwareId, state: GameState): boolean {
  const hypothetical = { ...state, hardware: { ...state.hardware, [id]: state.hardware[id] + 1 } };
  for (const model of MODELS) {
    if (!isModelUnlocked(model.id, state) && isModelUnlocked(model.id, hypothetical)) return true;
  }
  for (const hw of HARDWARE) {
    if (!isHardwareUnlocked(hw.id, state) && isHardwareUnlocked(hw.id, hypothetical)) return true;
  }
  return false;
}

function estimateUpgradeGain(id: UpgradeId, state: GameState, currentTPS: Decimal): number {
  if (state.upgrades.includes(id)) return 0;
  const hypothetical = { ...state, upgrades: [...state.upgrades, id] };
  const newTPS = computeRates(hypothetical).tokensPerSecond;
  return newTPS.sub(currentTPS).toNumber();
}

// ─── Score ────────────────────────────────────────────────────────────────────

export function computeScore(state: GameState): number {
  return (
    state.totalTokensEarned.toNumber() +
    state.prestigeCount * 1_000_000 +
    state.reputation * 500_000
  );
}
