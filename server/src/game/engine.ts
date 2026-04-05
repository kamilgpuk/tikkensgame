import {
  GameState,
  HardwareId,
  ModelId,
  InvestorId,
  UpgradeId,
  MilestoneId,
  ProducerType,
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

export function createInitialState(playerId: string, playerName: string): GameState {
  return {
    playerId,
    playerName,
    tokens: 0,
    compute: 0,
    hype: 0,
    funding: 0,
    totalTokensEarned: 0,
    totalClicks: 0,
    prestigeCount: 0,
    reputation: 0,
    tokensPerSecond: 0,
    computePerSecond: 0,
    fundingPerSecond: 0,
    clickPower: 1,
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
  computePerSecond: number;
  rawTokensPerSecond: number; // before hype
  tokensPerSecond: number;
  fundingPerSecond: number;
  clickPower: number;
} {
  const hwMult = getHardwareMultiplier(state);
  const modelMult = getModelMultiplier(state);
  const hypeMult = getHypeMultiplier(state);

  // Compute generated
  let computeGenerated = 0;
  for (const hw of HARDWARE) {
    computeGenerated += hw.computePerSec * state.hardware[hw.id] * hwMult;
  }

  // Compute consumed by models
  let computeConsumed = 0;
  for (const model of MODELS) {
    computeConsumed += model.computePerSec * state.models[model.id];
  }

  const computePerSecond = computeGenerated - computeConsumed;

  // Compute utilisation ratio (0..1). Models slow if compute is starved.
  const totalComputeNeeded = computeConsumed;
  const computeAvailable = Math.max(0, state.compute + computeGenerated);
  const utilisation = totalComputeNeeded > 0
    ? Math.min(1, computeAvailable / (totalComputeNeeded || 1))
    : 1;

  // Raw tokens/s (before hype)
  let rawTokens = 0;
  for (const model of MODELS) {
    rawTokens += model.tokensPerSec * state.models[model.id] * modelMult * utilisation;
  }

  // Reputation bonus
  const reputationBonus = reputationMultiplier(state.reputation);

  // Hype token multiplier: (1 + hype * hypeMult)
  const hypeBonus = 1 + state.hype * hypeMult;

  const tokensPerSecond = rawTokens * reputationBonus * hypeBonus;

  // Funding
  let fundingPerSecond = 0;
  for (const inv of INVESTORS) {
    fundingPerSecond += inv.fundingPerSec * state.investors[inv.id];
  }

  const clickPower = getClickMultiplier(state) * reputationBonus;

  return { computePerSecond, rawTokensPerSecond: rawTokens, tokensPerSecond, fundingPerSecond, clickPower };
}

// ─── Cost helpers ─────────────────────────────────────────────────────────────

export function producerCost(baseCost: number, owned: number, quantity = 1): number {
  // Sum of geometric series: base * (scale^owned + scale^(owned+1) + ... + scale^(owned+qty-1))
  // = base * scale^owned * (scale^qty - 1) / (scale - 1)
  if (quantity === 1) return baseCost * Math.pow(COST_SCALE, owned);
  return (
    baseCost *
    Math.pow(COST_SCALE, owned) *
    ((Math.pow(COST_SCALE, quantity) - 1) / (COST_SCALE - 1))
  );
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

  const newTokens = rates.tokensPerSecond * elapsed;
  const newCompute = rates.computePerSecond * elapsed;
  const newFunding = rates.fundingPerSecond * elapsed;

  const tokens = Math.max(0, state.tokens + newTokens);
  const compute = Math.max(0, state.compute + newCompute);
  const funding = state.funding + newFunding;
  const totalTokensEarned = state.totalTokensEarned + Math.max(0, newTokens);

  // Check milestones
  const newMilestones: MilestoneId[] = [];
  let hype = state.hype;
  const milestonesHit = [...state.milestonesHit];
  const hypeMilestoneMult = getHypeMilestoneMultiplier(state);

  for (const milestone of MILESTONES) {
    if (
      !milestonesHit.includes(milestone.id) &&
      totalTokensEarned >= milestone.totalTokensRequired
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
  const gained = rates.clickPower * n;
  return {
    ...state,
    tokens: state.tokens + gained,
    totalTokensEarned: state.totalTokensEarned + gained,
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
  if (state.tokens < cost) return { ok: false, error: "Not enough tokens" };
  const hardware = { ...state.hardware, [id]: state.hardware[id] + qty };
  const rates = computeRates({ ...state, hardware });
  return {
    ok: true,
    state: {
      ...state,
      tokens: state.tokens - cost,
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
  if (state.tokens < cost) return { ok: false, error: "Not enough tokens" };
  const models = { ...state.models, [id]: state.models[id] + qty };
  const rates = computeRates({ ...state, models });
  return {
    ok: true,
    state: {
      ...state,
      tokens: state.tokens - cost,
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
  if (state.tokens < cost) return { ok: false, error: "Not enough tokens" };
  const investors = { ...state.investors, [id]: state.investors[id] + qty };
  const rates = computeRates({ ...state, investors });
  return {
    ok: true,
    state: {
      ...state,
      tokens: state.tokens - cost,
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
  if (def.currency === "tokens" && state.tokens < def.cost) {
    return { ok: false, error: "Not enough tokens" };
  }
  if (def.currency === "funding" && state.funding < def.cost) {
    return { ok: false, error: "Not enough funding" };
  }
  const upgrades = [...state.upgrades, id];
  const newState = {
    ...state,
    tokens: def.currency === "tokens" ? state.tokens - def.cost : state.tokens,
    funding: def.currency === "funding" ? state.funding - def.cost : state.funding,
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
  if (state.totalTokensEarned < tokenGoal) {
    return { ok: false, error: `Need ${tokenGoal.toLocaleString()} total tokens earned` };
  }
  if (state.funding < fundingGoal) {
    return { ok: false, error: `Need ${fundingGoal.toLocaleString()} funding` };
  }

  // Reputation gained: log10 of tokens earned at prestige time (scaled)
  const reputationGain = Math.floor(Math.log10(Math.max(1, state.totalTokensEarned)));
  const reputation = state.reputation + reputationGain;
  const prestigeCount = state.prestigeCount + 1;

  const fresh = createInitialState(state.playerId, state.playerName);
  return {
    ok: true,
    state: {
      ...fresh,
      reputation,
      prestigeCount,
      // keep lifetime hype (it's a prestige bonus)
      hype: state.hype * 0.1, // keep 10% hype on prestige
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
    // Adding one unit of hardware adds compute, which may allow more models
    // Estimate tokens/s gain as indirect; for simplicity use 0 (it's a multiplier prerequisite)
    actions.push({
      type: "hardware",
      id: hw.id,
      name: hw.name,
      cost,
      currency: "tokens",
      affordable: state.tokens >= cost,
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
    const paybackSeconds = tokensPerSecGain > 0 ? cost / tokensPerSecGain : null;
    actions.push({
      type: "model",
      id: model.id,
      name: model.name,
      cost,
      currency: "tokens",
      affordable: state.tokens >= cost,
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
      cost,
      currency: "tokens",
      affordable: state.tokens >= cost,
      tokensPerSecGain: 0,
      paybackSeconds: null,
      unlocksNew: false,
    });
  }

  for (const upg of UPGRADES) {
    if (state.upgrades.includes(upg.id)) continue;
    const affordable =
      upg.currency === "tokens" ? state.tokens >= upg.cost : state.funding >= upg.cost;
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
  // Check if buying one more of this hardware would unlock new things
  const hypothetical = { ...state, hardware: { ...state.hardware, [id]: state.hardware[id] + 1 } };
  for (const model of MODELS) {
    if (!isModelUnlocked(model.id, state) && isModelUnlocked(model.id, hypothetical)) return true;
  }
  for (const hw of HARDWARE) {
    if (!isHardwareUnlocked(hw.id, state) && isHardwareUnlocked(hw.id, hypothetical)) return true;
  }
  return false;
}

function estimateUpgradeGain(id: UpgradeId, state: GameState, currentTPS: number): number {
  const def = UPGRADE_MAP[id];
  if (state.upgrades.includes(id)) return 0;
  const hypothetical = { ...state, upgrades: [...state.upgrades, id] };
  const newTPS = computeRates(hypothetical).tokensPerSecond;
  return newTPS - currentTPS;
}

// ─── Score ────────────────────────────────────────────────────────────────────

export function computeScore(state: GameState): number {
  return (
    state.totalTokensEarned +
    state.prestigeCount * 1_000_000 +
    state.reputation * 500_000
  );
}
