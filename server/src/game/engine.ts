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
  COST_SCALE,
  prestigeTokenThreshold,
  prestigeFundingThreshold,
  reputationMultiplier,
} from "@ai-hype/shared";

// ─── Initial state ────────────────────────────────────────────────────────────

const D0 = new Decimal(0);
const D1 = new Decimal(1);

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
    clickPower: D1,
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

function getClickMultiplier(state: GameState): number {
  let m = 1;
  for (const id of state.upgrades) {
    const def = UPGRADE_MAP[id];
    if (def.effect.type === "clickMultiplier") m *= def.effect.factor;
  }
  return m;
}

function getHardwareMultiplier(state: GameState): number {
  let m = 1;
  for (const id of state.upgrades) {
    const def = UPGRADE_MAP[id];
    if (def.effect.type === "hardwareMultiplier" || def.effect.type === "allProducerMultiplier") {
      m *= def.effect.factor;
    }
  }
  return m;
}

function getModelMultiplier(state: GameState): number {
  let m = 1;
  for (const id of state.upgrades) {
    const def = UPGRADE_MAP[id];
    if (def.effect.type === "modelMultiplier" || def.effect.type === "allProducerMultiplier") {
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

// ─── Rate computation ─────────────────────────────────────────────────────────

export function computeRates(state: GameState): {
  computePerSecond: Decimal;
  rawTokensPerSecond: Decimal; // before hype
  tokensPerSecond: Decimal;
  fundingPerSecond: Decimal;
  clickPower: Decimal;
} {
  const hwMult = getHardwareMultiplier(state);
  const modelMult = getModelMultiplier(state);
  const hypeMult = getHypeMultiplier(state);

  // Compute generated
  let computeGenerated = D0;
  for (const hw of HARDWARE) {
    computeGenerated = computeGenerated.add(
      new Decimal(hw.computePerSec * state.hardware[hw.id] * hwMult)
    );
  }

  // Compute consumed by models
  let computeConsumed = D0;
  for (const model of MODELS) {
    computeConsumed = computeConsumed.add(
      new Decimal(model.computePerSec * state.models[model.id])
    );
  }

  const computePerSecond = computeGenerated.sub(computeConsumed);

  // Compute utilisation ratio (0..1). Models slow if compute is starved.
  const totalComputeNeeded = computeConsumed;
  const computeAvailable = Decimal.max(D0, state.compute.add(computeGenerated));
  const utilisation = totalComputeNeeded.gt(0)
    ? Decimal.min(D1, computeAvailable.div(totalComputeNeeded))
    : D1;

  // Raw tokens/s (before hype)
  let rawTokens = D0;
  for (const model of MODELS) {
    rawTokens = rawTokens.add(
      new Decimal(model.tokensPerSec * state.models[model.id] * modelMult).mul(utilisation)
    );
  }

  // Reputation bonus (stays as number — result is small)
  const reputationBonus = reputationMultiplier(state.reputation);

  // Hype token multiplier: (1 + hype * hypeMult) — stays as number
  const hypeBonus = 1 + state.hype * hypeMult;

  const tokensPerSecond = rawTokens.mul(reputationBonus).mul(hypeBonus);

  // Funding
  let fundingPerSecond = D0;
  for (const inv of INVESTORS) {
    fundingPerSecond = fundingPerSecond.add(
      new Decimal(inv.fundingPerSec * state.investors[inv.id])
    );
  }

  const clickPower = new Decimal(getClickMultiplier(state) * reputationBonus);

  return { computePerSecond, rawTokensPerSecond: rawTokens, tokensPerSecond, fundingPerSecond, clickPower };
}

// ─── Cost helpers ─────────────────────────────────────────────────────────────

export function producerCost(baseCost: number, owned: number, quantity = 1): Decimal {
  // Sum of geometric series: base * (scale^owned + scale^(owned+1) + ... + scale^(owned+qty-1))
  // = base * scale^owned * (scale^qty - 1) / (scale - 1)
  if (quantity === 1) {
    return new Decimal(baseCost).mul(Decimal.pow(COST_SCALE, owned));
  }
  return new Decimal(baseCost)
    .mul(Decimal.pow(COST_SCALE, owned))
    .mul(Decimal.pow(COST_SCALE, quantity).sub(1).div(COST_SCALE - 1));
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

  const tokens = Decimal.max(D0, state.tokens.add(newTokens));
  const compute = Decimal.max(D0, state.compute.add(newCompute));
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
  const cost = producerCost(def.baseCost, state.hardware[id], qty);
  if (state.tokens.lt(cost)) return { ok: false, error: "Not enough tokens" };
  const hardware = { ...state.hardware, [id]: state.hardware[id] + qty };
  const rates = computeRates({ ...state, hardware });
  return {
    ok: true,
    state: {
      ...state,
      tokens: state.tokens.sub(cost),
      hardware,
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
  const cost = producerCost(def.baseCost, state.models[id], qty);
  if (state.tokens.lt(cost)) return { ok: false, error: "Not enough tokens" };
  const models = { ...state.models, [id]: state.models[id] + qty };
  const rates = computeRates({ ...state, models });
  return {
    ok: true,
    state: {
      ...state,
      tokens: state.tokens.sub(cost),
      models,
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
  const cost = producerCost(def.baseCost, state.investors[id], qty);
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

  // Reputation gained: log10 of tokens earned at prestige time (scaled)
  // log10 of a Decimal → result is small enough to toNumber() safely
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
      // keep 10% hype on prestige
      hype: state.hype * 0.1,
      updatedAt: Date.now(),
    },
  };
}

// ─── Available actions (for MCP ROI) ─────────────────────────────────────────

export function getAvailableActions(state: GameState): ActionOption[] {
  const actions: ActionOption[] = [];
  const rates = computeRates(state);

  for (const hw of HARDWARE) {
    if (!isHardwareUnlocked(hw.id, state)) continue;
    const cost = producerCost(hw.baseCost, state.hardware[hw.id]);
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
    });
  }

  for (const model of MODELS) {
    if (!isModelUnlocked(model.id, state)) continue;
    const cost = producerCost(model.baseCost, state.models[model.id]);
    const hwMult = getHardwareMultiplier(state);
    const modelMult = getModelMultiplier(state);
    const hypeBonus = 1 + state.hype;
    const reputationBonus = reputationMultiplier(state.reputation);
    const tokensPerSecGain = model.tokensPerSec * modelMult * hypeBonus * reputationBonus * hwMult;
    const paybackSeconds = tokensPerSecGain > 0 ? cost.toNumber() / tokensPerSecGain : null;
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
    });
  }

  for (const inv of INVESTORS) {
    if (!isInvestorUnlocked(inv.id, state)) continue;
    const cost = producerCost(inv.baseCost, state.investors[inv.id]);
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

  return actions.sort((a, b) => {
    // Sort: affordable first, then by payback period
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
  const def = UPGRADE_MAP[id];
  if (state.upgrades.includes(id)) return 0;
  const hypothetical = { ...state, upgrades: [...state.upgrades, id] };
  const newTPS = computeRates(hypothetical).tokensPerSecond;
  return newTPS.sub(currentTPS).toNumber();
}

// ─── Score ────────────────────────────────────────────────────────────────────

export function computeScore(state: GameState): number {
  // Returns a plain number for the DB score column (leaderboard ranking proxy)
  // Precision loss is acceptable here — score is for display/sorting only
  return (
    state.totalTokensEarned.toNumber() +
    state.prestigeCount * 1_000_000 +
    state.reputation * 500_000
  );
}
