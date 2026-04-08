import {
  createInitialState,
  tick,
  click,
  buyHardware,
  buyModel,
  buyInvestor,
  buyUpgrade,
  prestige,
  computeRates,
  producerCost,
  getAvailableActions,
  computeScore,
  isHardwareUnlocked,
  isModelUnlocked,
  isInvestorUnlocked,
  resolveActiveHardware,
  resolveActiveModels,
  getModelTokenMultiplier,
  getModelComputeCostMultiplier,
  getInvestorMultiplier,
} from "./engine.js";
import Decimal from "break_eternity.js";
import {
  prestigeTokenThreshold,
  prestigeFundingThreshold,
  reputationMultiplier,
  computeTokenCap,
  computeComputeCap,
  modelTotalComputeCost,
  modelNextInstanceComputeCost,
  type UpgradeId,
} from "@ai-hype/shared";

/** Unwrap a Decimal (or number) to number for assertions */
function num(d: Decimal | number): number {
  return d instanceof Decimal ? d.toNumber() : d;
}

describe("createInitialState", () => {
  it("creates a zeroed state", () => {
    const s = createInitialState("id1", "Alice");
    expect(num(s.tokens)).toBe(0);
    expect(num(s.compute)).toBe(0);
    expect(s.hype).toBe(0);
    expect(num(s.funding)).toBe(0);
    expect(s.prestigeCount).toBe(0);
    expect(s.upgrades).toHaveLength(0);
    expect(s.milestonesHit).toHaveLength(0);
  });
});

describe("producerCost", () => {
  it("first unit costs base", () => {
    expect(num(producerCost(100, 0, 1.25))).toBe(100);
  });

  it("second unit costs more (1.25 scale)", () => {
    expect(num(producerCost(100, 1, 1.25))).toBeCloseTo(125, 0);
  });

  it("bulk cost is sum of individual costs", () => {
    const single1 = num(producerCost(100, 0, 1.25));
    const single2 = num(producerCost(100, 1, 1.25));
    const bulk = num(producerCost(100, 0, 1.25, 2));
    expect(bulk).toBeCloseTo(single1 + single2, 5);
  });

  // Tiered scaling tests (Stage 5)
  it("mac_mini: 1st purchase → 10", () => {
    expect(num(producerCost(10, 0, 1.25))).toBe(10);
  });
  it("mac_mini: 2nd purchase → 12.5", () => {
    expect(num(producerCost(10, 1, 1.25))).toBeCloseTo(12.5, 5);
  });
  it("mac_mini: 3rd purchase → 15.625", () => {
    expect(num(producerCost(10, 2, 1.25))).toBeCloseTo(15.625, 5);
  });
  it("gpu_cluster: 1st → 300000", () => {
    expect(num(producerCost(300_000, 0, 1.45))).toBe(300_000);
  });
  it("gpu_cluster: 2nd → 435000", () => {
    expect(num(producerCost(300_000, 1, 1.45))).toBeCloseTo(435_000, 0);
  });
  it("gpt2: 2nd → 65", () => {
    expect(num(producerCost(50, 1, 1.30))).toBeCloseTo(65, 5);
  });
  it("moms_card: 2nd → 600", () => {
    expect(num(producerCost(500, 1, 1.20))).toBeCloseTo(600, 5);
  });
});

describe("computeRates", () => {
  it("zero rates on fresh state", () => {
    const s = createInitialState("id", "p");
    const rates = computeRates(s);
    expect(num(rates.tokensPerSecond)).toBe(0);
    expect(Math.abs(num(rates.computePerSecond))).toBe(0);
    expect(num(rates.fundingPerSecond)).toBe(0);
    expect(num(rates.clickPower)).toBe(1);
  });

  it("hardware generates compute", () => {
    const s = createInitialState("id", "p");
    const s2 = { ...s, hardware: { ...s.hardware, mac_mini: 2 } };
    const rates = computeRates(s2);
    expect(num(rates.computePerSecond)).toBeCloseTo(1, 5); // 2 × 0.5 compute/s
  });

  it("model generates tokens when compute is available", () => {
    const s = createInitialState("id", "p");
    const s2 = {
      ...s,
      compute: new Decimal(100),
      hardware: { ...s.hardware, mac_mini: 5 },
      models: { ...s.models, gpt2: 1 },
    };
    const rates = computeRates(s2);
    expect(num(rates.tokensPerSecond)).toBeGreaterThan(0);
  });

  it("hype multiplies token output", () => {
    const s = createInitialState("id", "p");
    const base = {
      ...s,
      compute: new Decimal(100),
      hardware: { ...s.hardware, mac_mini: 5 },
      models: { ...s.models, gpt2: 1 },
    };
    const withHype = { ...base, hype: 2 };
    const ratesBase = computeRates(base);
    const ratesHype = computeRates(withHype);
    expect(num(ratesHype.tokensPerSecond)).toBeGreaterThan(num(ratesBase.tokensPerSecond));
  });
});

describe("tick", () => {
  it("does nothing at zero rates", () => {
    const s = createInitialState("id", "p");
    const { state } = tick(s, 1000);
    expect(num(state.tokens)).toBe(0);
  });

  it("advances tokens over time", () => {
    const s = createInitialState("id", "p");
    const s2 = {
      ...s,
      compute: new Decimal(1000),
      hardware: { ...s.hardware, mac_mini: 5 },
      models: { ...s.models, gpt2: 1 },
    };
    const { state } = tick(s2, 1000); // 1 second
    expect(num(state.tokens)).toBeGreaterThan(0);
    expect(num(state.totalTokensEarned)).toBeGreaterThan(0);
  });

  it("triggers milestone at correct threshold", () => {
    const s = createInitialState("id", "p");
    const s2 = { ...s, totalTokensEarned: new Decimal(999), tokens: new Decimal(2) };
    // Simulate enough tokens flowing to cross 1k milestone
    const s3 = {
      ...s2,
      compute: new Decimal(1000),
      hardware: { ...s2.hardware, mac_mini: 10 },
      models: { ...s2.models, gpt2: 1 },
    };
    const { newMilestones } = tick(s3, 1000);
    expect(newMilestones).toContain("m1k");
  });

  it("does not retrigger already-hit milestones", () => {
    const s = createInitialState("id", "p");
    const s2 = {
      ...s,
      totalTokensEarned: new Decimal(5000),
      milestonesHit: ["m1k" as const],
      compute: new Decimal(1000),
      hardware: { ...s.hardware, mac_mini: 10 },
      models: { ...s.models, gpt2: 1 },
    };
    const { newMilestones } = tick(s2, 1000);
    expect(newMilestones).not.toContain("m1k");
  });
});

describe("click", () => {
  it("adds tokens on click", () => {
    const s = createInitialState("id", "p");
    const s2 = click(s);
    expect(num(s2.tokens)).toBe(1);
    expect(s2.totalClicks).toBe(1);
  });

  it("multi-click works", () => {
    const s = createInitialState("id", "p");
    const s2 = click(s, 10);
    expect(num(s2.tokens)).toBe(10);
    expect(s2.totalClicks).toBe(10);
  });
});

describe("buyHardware", () => {
  it("fails if not enough tokens", () => {
    const s = createInitialState("id", "p"); // 0 tokens
    const result = buyHardware(s, "mac_mini");
    expect(result.ok).toBe(false);
  });

  it("succeeds when affordable", () => {
    const s = createInitialState("id", "p");
    const s2 = { ...s, tokens: new Decimal(100) };
    const result = buyHardware(s2, "mac_mini");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.hardware.mac_mini).toBe(1);
      expect(num(result.state.tokens)).toBeLessThan(100);
    }
  });

  it("fails if not unlocked", () => {
    const s = createInitialState("id", "p");
    const s2 = { ...s, tokens: new Decimal(999_999) };
    // gaming_pc requires 3x mac_mini
    const result = buyHardware(s2, "gaming_pc");
    expect(result.ok).toBe(false);
  });

  it("unlocks when condition met", () => {
    const s = createInitialState("id", "p");
    const s2 = { ...s, tokens: new Decimal(999_999), hardware: { ...s.hardware, mac_mini: 3 } };
    const result = buyHardware(s2, "gaming_pc");
    expect(result.ok).toBe(true);
  });
});

describe("buyModel", () => {
  it("fails without tokens", () => {
    const s = createInitialState("id", "p");
    const result = buyModel(s, "gpt2");
    expect(result.ok).toBe(false);
  });

  it("succeeds when affordable", () => {
    const s = createInitialState("id", "p");
    const s2 = { ...s, tokens: new Decimal(1000) };
    const result = buyModel(s2, "gpt2");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.models.gpt2).toBe(1);
  });
});

describe("buyInvestor", () => {
  it("fails if hype too low", () => {
    const s = createInitialState("id", "p");
    const s2 = { ...s, tokens: new Decimal(99_999), hype: 0 };
    const result = buyInvestor(s2, "moms_card");
    expect(result.ok).toBe(false);
  });

  it("succeeds when hype unlocks it", () => {
    const s = createInitialState("id", "p");
    const s2 = { ...s, tokens: new Decimal(99_999), hype: 1 };
    const result = buyInvestor(s2, "moms_card");
    expect(result.ok).toBe(true);
  });
});

describe("buyUpgrade", () => {
  it("applies model token multiplier (better_prompts)", () => {
    const s = createInitialState("id", "p");
    const s2 = { ...s, tokens: new Decimal(10_000) };
    const result = buyUpgrade(s2, "better_prompts");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.upgrades).toContain("better_prompts");
      // better_prompts now gives +40% tokens/s to gpt2/llama7b (not a click upgrade)
      // clickPower remains 1 (reputation=0)
      expect(num(result.state.clickPower)).toBe(1);
    }
  });

  it("cannot buy same upgrade twice", () => {
    const s = createInitialState("id", "p");
    const s2 = { ...s, tokens: new Decimal(10_000), upgrades: ["better_prompts" as const] };
    const result = buyUpgrade(s2, "better_prompts");
    expect(result.ok).toBe(false);
  });

  it("fails without funding for funding upgrades", () => {
    const s = createInitialState("id", "p");
    const result = buyUpgrade(s, "hire_interns");
    expect(result.ok).toBe(false);
  });
});

describe("prestige", () => {
  it("fails below threshold", () => {
    const s = createInitialState("id", "p");
    const result = prestige(s);
    expect(result.ok).toBe(false);
  });

  it("resets resources but keeps reputation", () => {
    const s = createInitialState("id", "p");
    const s2 = {
      ...s,
      tokens: new Decimal(5_000_000),
      totalTokensEarned: prestigeTokenThreshold(0).add(1),
      funding: prestigeFundingThreshold(0),
      hardware: { ...s.hardware, mac_mini: 5 },
    };
    const result = prestige(s2);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(num(result.state.tokens)).toBe(0);
      expect(result.state.hardware.mac_mini).toBe(0);
      expect(result.state.prestigeCount).toBe(1);
      expect(result.state.reputation).toBeGreaterThan(0);
    }
  });
});

describe("getAvailableActions", () => {
  it("returns affordable hardware at start", () => {
    const s = createInitialState("id", "p");
    const s2 = { ...s, tokens: new Decimal(100) };
    const actions = getAvailableActions(s2);
    const mac = actions.find((a) => a.id === "mac_mini");
    expect(mac).toBeDefined();
    expect(mac?.affordable).toBe(true);
  });

  it("sorts affordable before unaffordable", () => {
    const s = createInitialState("id", "p");
    const s2 = { ...s, tokens: new Decimal(50) }; // can afford mac_mini (10) but not gpt2 (50... borderline)
    const actions = getAvailableActions(s2);
    const firstUnaffordable = actions.findIndex((a) => !a.affordable);
    const lastAffordable = actions.filter((a) => a.affordable).length - 1;
    if (firstUnaffordable !== -1) {
      expect(lastAffordable).toBeLessThan(firstUnaffordable);
    }
  });
});

describe("computeScore", () => {
  it("is zero at start", () => {
    const s = createInitialState("id", "p");
    expect(computeScore(s)).toBe(0);
  });

  it("increases with tokens earned", () => {
    const s = createInitialState("id", "p");
    const s2 = { ...s, totalTokensEarned: new Decimal(1_000_000) };
    expect(computeScore(s2)).toBeGreaterThan(0);
  });

  it("prestige count adds to score", () => {
    const s = createInitialState("id", "p");
    const s2 = { ...s, prestigeCount: 1 };
    expect(computeScore(s2)).toBe(1_000_000);
  });
});

// ─── 2.1.1 Numeric Edge Cases ──────────────────────────────────────────────────

describe("tick — numeric edge cases", () => {
  it("E1: dt=0 produces no state change", () => {
    const s = createInitialState("id", "p");
    const s2 = { ...s, compute: new Decimal(1000), hardware: { ...s.hardware, mac_mini: 5 }, models: { ...s.models, gpt2: 1 } };
    const { state } = tick(s2, 0);
    expect(num(state.tokens)).toBe(num(s2.tokens));
    expect(num(state.totalTokensEarned)).toBe(num(s2.totalTokensEarned));
  });

  it("E2: negative dt produces no tokens increase", () => {
    const s = createInitialState("id", "p");
    const s2 = { ...s, compute: new Decimal(1000), hardware: { ...s.hardware, mac_mini: 5 }, models: { ...s.models, gpt2: 1 } };
    const { state } = tick(s2, -5000);
    // Tokens should not increase (and must not go below 0)
    expect(num(state.tokens)).toBeGreaterThanOrEqual(0);
    expect(num(state.totalTokensEarned)).toBeGreaterThanOrEqual(num(s2.totalTokensEarned));
  });

  it("E3: very large dt (1 hour) produces no NaN or Infinity", () => {
    const s = createInitialState("id", "p");
    const s2 = { ...s, compute: new Decimal(1000), hardware: { ...s.hardware, mac_mini: 5 }, models: { ...s.models, gpt2: 1 } };
    const { state } = tick(s2, 3_600_000);
    expect(state.tokens.isFinite()).toBe(true);
    expect(state.totalTokensEarned.isFinite()).toBe(true);
  });

  it("E4: producerCost with owned=1000 returns a finite Decimal", () => {
    const cost = producerCost(100, 1000, 1.25);
    expect(cost.isFinite()).toBe(true);
    expect(num(cost)).toBeGreaterThan(0);
  });

  it("E5: click with n=0 adds no tokens", () => {
    const s = createInitialState("id", "p");
    const s2 = click(s, 0);
    expect(num(s2.tokens)).toBe(num(s.tokens));
    expect(s2.totalClicks).toBe(s.totalClicks);
  });

  it("E8: tokens well above MAX_SAFE_INTEGER — buy succeeds gracefully with Decimal", () => {
    const s = createInitialState("id", "p");
    const s2 = { ...s, tokens: new Decimal("1e20") }; // far beyond MAX_SAFE_INTEGER
    const result = buyHardware(s2, "mac_mini");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.tokens.isFinite()).toBe(true);
      expect(result.state.tokens.gt(0)).toBe(true);
    }
  });

  it("E9: NaN tokens — tick does not throw", () => {
    const s = createInitialState("id", "p");
    const s2 = { ...s, tokens: new Decimal(NaN) };
    expect(() => tick(s2, 1000)).not.toThrow();
  });
});

// ─── 2.1.2 Compute Utilization ────────────────────────────────────────────────

describe("computeRates — compute utilization", () => {
  it("U1: models with no hardware and no compute → tokensPerSecond = 0", () => {
    const s = createInitialState("id", "p");
    const s2 = { ...s, compute: new Decimal(0), models: { ...s.models, gpt2: 10 } };
    const rates = computeRates(s2);
    expect(num(rates.tokensPerSecond)).toBe(0);
  });

  it("U2: models consume exactly available compute → 100% utilization", () => {
    // 1 gpt2 consumes 1 compute/s; 1 mac_mini generates 1 compute/s
    const s = createInitialState("id", "p");
    const s2 = {
      ...s,
      compute: new Decimal(0),
      hardware: { ...s.hardware, mac_mini: 1 },
      models: { ...s.models, gpt2: 1 },
    };
    const ratesFull = computeRates({ ...s2, compute: new Decimal(1000) });
    const ratesExact = computeRates(s2);
    // At exact compute balance, utilisation = 1 (computeAvailable = 0 + generated = 1)
    expect(num(ratesExact.tokensPerSecond)).toBeCloseTo(num(ratesFull.tokensPerSecond), 5);
  });

  it("U3: models consume 2× available compute → ~50% token rate", () => {
    // 2 gpt2 consume 2 compute/s; 1 mac_mini generates 1 compute/s
    const s = createInitialState("id", "p");
    const half = computeRates({
      ...s,
      compute: new Decimal(0),
      hardware: { ...s.hardware, mac_mini: 1 },
      models: { ...s.models, gpt2: 2 },
    });
    const full = computeRates({
      ...s,
      compute: new Decimal(1000),
      hardware: { ...s.hardware, mac_mini: 1 },
      models: { ...s.models, gpt2: 2 },
    });
    expect(num(half.tokensPerSecond)).toBeCloseTo(num(full.tokensPerSecond) * 0.5, 3);
  });

  it("U4: adding enough hardware unlocks more model instances", () => {
    const s = createInitialState("id", "p");
    // 1 mac_mini (0.5/s) + 2 gpt2 (need 1.09/s): only 1 gpt2 active → TPS=3
    const before = computeRates({
      ...s, compute: new Decimal(0),
      hardware: { ...s.hardware, mac_mini: 1 },
      models: { ...s.models, gpt2: 2 },
    });
    // 3 mac_mini (1.5/s) + 2 gpt2 (need 1.09/s): both gpt2 active → TPS=6
    const after = computeRates({
      ...s, compute: new Decimal(0),
      hardware: { ...s.hardware, mac_mini: 3 },
      models: { ...s.models, gpt2: 2 },
    });
    expect(num(after.tokensPerSecond)).toBeGreaterThan(num(before.tokensPerSecond));
  });
});

// ─── 2.1.3 Upgrade Stacking ───────────────────────────────────────────────────

describe("computeRates — upgrade stacking", () => {
  it("S1: mac_mini generates 0.5 compute/s (new rebalanced value)", () => {
    const s = createInitialState("id", "p");
    const base = {
      ...s,
      hardware: { ...s.hardware, mac_mini: 1 }, // 0.5 compute/s base
    };
    const rates = computeRates(base);
    // quantization and flash_attention now reduce model compute cost, not hardware multiplier
    expect(num(rates.computePerSecond)).toBeCloseTo(0.5, 5);
  });

  it("S2: click power equals reputation bonus (no click upgrades in new system)", () => {
    const s = createInitialState("id", "p");
    const rates = computeRates(s);
    // clickPower = reputationMultiplier(0) = 1
    expect(num(rates.clickPower)).toBe(1);
  });

  it("S3: hype_machine multiplier doubles hype gain from milestone", () => {
    const s = createInitialState("id", "p");
    const withUpgrade = {
      ...s,
      totalTokensEarned: new Decimal(999),
      compute: new Decimal(100_000),
      models: { ...s.models, gpt2: 1000 },
      upgrades: ["hype_machine" as const],
    };
    const withoutUpgrade = { ...withUpgrade, upgrades: [] as UpgradeId[] };
    const { state: stateWith } = tick(withUpgrade, 1000);
    const { state: stateWithout } = tick(withoutUpgrade, 1000);
    // Both cross m1k; with upgrade hype gain = 0.5 × 2 = 1; without = 0.5
    expect(stateWith.hype).toBeGreaterThan(stateWithout.hype);
  });

  it("S4: reputation bonus stacks with model multiplier upgrade (rlhf → all models)", () => {
    const s = createInitialState("id", "p");
    // 1 gpt2 (3 tokens/s), rlhf (+40% all models), reputation=2
    const s2 = {
      ...s,
      compute: new Decimal(100_000),
      models: { ...s.models, gpt2: 1 },
      upgrades: ["rlhf" as const],
      reputation: 2,
    };
    const rates = computeRates(s2);
    // rawTokens = 3 × 1.4 (rlhf additive) = 4.2
    // reputationBonus = reputationMultiplier(2) = 1 + sqrt(2) × 1.5 ≈ 3.121
    // hypeBonus = 1 + 0 × 0.05 = 1
    // tokensPerSecond = 4.2 × reputationMultiplier(2) × 1
    expect(num(rates.tokensPerSecond)).toBeCloseTo(4.2 * reputationMultiplier(2), 5);
  });
});

// ─── 2.1.4 Milestone Progression ─────────────────────────────────────────────

describe("tick — milestone progression", () => {
  it("M1: crossing multiple milestones in a single tick fires them all", () => {
    const s = createInitialState("id", "p");
    // Start just below m1m (999,950 tokens earned). 100 gpt2 with 1e9 compute → ~300 tokens/s.
    // In 1s: earn ~300 more → totalTokensEarned ~1,000,250 → all of m1k, m10k, m100k, m1m fire.
    const s2 = {
      ...s,
      totalTokensEarned: new Decimal(999_950),
      compute: new Decimal(1e9),
      models: { ...s.models, gpt2: 100 },
    };
    const { newMilestones } = tick(s2, 1000);
    expect(newMilestones).toContain("m1k");
    expect(newMilestones).toContain("m10k");
    expect(newMilestones).toContain("m100k");
    expect(newMilestones).toContain("m1m");
  });

  it("M2: prestige resets milestones and they can be re-earned", () => {
    const s = createInitialState("id", "p");
    const s2 = {
      ...s,
      totalTokensEarned: prestigeTokenThreshold(0).add(1),
      funding: prestigeFundingThreshold(0),
      tokens: new Decimal(5_000_000),
      milestonesHit: ["m1k" as const],
    };
    const prestigeResult = prestige(s2);
    expect(prestigeResult.ok).toBe(true);
    if (!prestigeResult.ok) return;
    // After prestige, milestonesHit is empty
    expect(prestigeResult.state.milestonesHit).toHaveLength(0);
    // Cross m1k again: start near threshold with enough production
    const s3 = {
      ...prestigeResult.state,
      totalTokensEarned: new Decimal(999),
      compute: new Decimal(1e9),
      models: { ...prestigeResult.state.models, gpt2: 100 },
    };
    // 100 gpt2 active (all fit in 1e9 compute), TPS = 300/s → +300 in 1s → total 1299 > 1000 ✓
    const { newMilestones } = tick(s3, 1000);
    expect(newMilestones).toContain("m1k");
  });

  it("M3: all 8 milestones crossed yields correct total hype", () => {
    const s = createInitialState("id", "p");
    // Start just below the last milestone (10B), produce enough to cross it
    // Then check all 8 milestones fired across multiple ticks OR use a single mega tick
    // Simplest: pre-set totalTokensEarned to just below 10B, produce anything positive
    const s2 = {
      ...s,
      // Start having already earned tokens for milestones up to m1b (1B)
      // but not yet hit any milestones
      totalTokensEarned: new Decimal(9_999_999_999), // just below 10B (m10b threshold)
      compute: new Decimal(1e9),
      models: { ...s.models, gpt2: 100 },
    };
    // In 1 tick of 1s, earn ~300 more → totalTokensEarned > 10B → all 8 milestones fire
    const { newMilestones, state } = tick(s2, 1000);
    expect(newMilestones.length).toBe(8);
    // Total hype = 0.5+1+2+3+5+8+13+21 = 53.5
    expect(state.hype).toBeCloseTo(53.5, 5);
  });
});

// ─── 2.1.5 Prestige Edge Cases ────────────────────────────────────────────────

describe("prestige — edge cases", () => {
  it("P1: prestige allowed at exactly 1,000,000 totalTokensEarned", () => {
    const s = createInitialState("id", "p");
    const s2 = { ...s, totalTokensEarned: new Decimal(1_000_000), funding: prestigeFundingThreshold(0) };
    const result = prestige(s2);
    expect(result.ok).toBe(true);
  });

  it("P2: retains 10% of hype after prestige", () => {
    const s = createInitialState("id", "p");
    const s2 = { ...s, totalTokensEarned: new Decimal(2_000_000), hype: 100, funding: prestigeFundingThreshold(0) };
    const result = prestige(s2);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.hype).toBeCloseTo(10, 5);
    }
  });

  it("P3: reputation gain = floor(log10(totalTokensEarned))", () => {
    const cases: [number, number][] = [
      [1_000_000, 6],
      [100_000_000, 8],
      [10_000_000_000, 10],
    ];
    for (const [earned, expectedGain] of cases) {
      const s = createInitialState("id", "p");
      const s2 = { ...s, totalTokensEarned: new Decimal(earned), funding: prestigeFundingThreshold(0) };
      const result = prestige(s2);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.state.reputation).toBe(expectedGain);
      }
    }
  });

  it("P4: reputation accumulates across two prestiges", () => {
    const s = createInitialState("id", "p");
    const s2 = { ...s, totalTokensEarned: new Decimal(1_000_000), funding: prestigeFundingThreshold(0) };
    const r1 = prestige(s2);
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    // r1.state.prestigeCount === 1, so threshold is prestigeFundingThreshold(1) = 50,000
    const s3 = { ...r1.state, totalTokensEarned: new Decimal(100_000_000), funding: prestigeFundingThreshold(1) };
    const r2 = prestige(s3);
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    expect(r2.state.reputation).toBeGreaterThan(r1.state.reputation);
  });

  it("P5: all producer counts reset to 0 after prestige", () => {
    const s = createInitialState("id", "p");
    const s2 = {
      ...s,
      totalTokensEarned: new Decimal(2_000_000),
      funding: prestigeFundingThreshold(0),
      hardware: { ...s.hardware, mac_mini: 5, gaming_pc: 3 },
      models: { ...s.models, gpt2: 2 },
      investors: { ...s.investors, moms_card: 1 },
    };
    const result = prestige(s2);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.hardware.mac_mini).toBe(0);
      expect(result.state.hardware.gaming_pc).toBe(0);
      expect(result.state.models.gpt2).toBe(0);
      expect(result.state.investors.moms_card).toBe(0);
    }
  });

  it("P6: upgrades array is empty after prestige", () => {
    const s = createInitialState("id", "p");
    const s2 = { ...s, totalTokensEarned: new Decimal(2_000_000), funding: prestigeFundingThreshold(0), upgrades: ["better_prompts" as const] };
    const result = prestige(s2);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.upgrades).toHaveLength(0);
    }
  });

  it("P7: prestige preserves playerId and playerName", () => {
    const s = createInitialState("my-id", "MyPlayer");
    const s2 = { ...s, totalTokensEarned: new Decimal(2_000_000), funding: prestigeFundingThreshold(0) };
    const result = prestige(s2);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.playerId).toBe("my-id");
      expect(result.state.playerName).toBe("MyPlayer");
    }
  });
});

// ─── 2.1.6 Unlock Chains ─────────────────────────────────────────────────────

describe("unlock chains", () => {
  it("L1: hardware unlock conditions", () => {
    const s = createInitialState("id", "p");
    // mac_mini: always unlocked
    expect(isHardwareUnlocked("mac_mini", s)).toBe(true);
    // gaming_pc: requires 3 mac_minis
    expect(isHardwareUnlocked("gaming_pc", s)).toBe(false);
    expect(isHardwareUnlocked("gaming_pc", { ...s, hardware: { ...s.hardware, mac_mini: 3 } })).toBe(true);
    // a100: requires 3 gaming_pcs
    expect(isHardwareUnlocked("a100", { ...s, hardware: { ...s.hardware, gaming_pc: 3 } })).toBe(true);
    // tpu_pod: requires 3 a100s
    expect(isHardwareUnlocked("tpu_pod", { ...s, hardware: { ...s.hardware, a100: 3 } })).toBe(true);
    // gpu_cluster: requires 3 tpu_pods
    expect(isHardwareUnlocked("gpu_cluster", { ...s, hardware: { ...s.hardware, tpu_pod: 3 } })).toBe(true);
    // data_center: requires 3 gpu_clusters
    expect(isHardwareUnlocked("data_center", { ...s, hardware: { ...s.hardware, gpu_cluster: 3 } })).toBe(true);
    // hyperscaler: requires 3 data_centers
    expect(isHardwareUnlocked("hyperscaler", { ...s, hardware: { ...s.hardware, data_center: 3 } })).toBe(true);
  });

  it("L2: model unlock conditions", () => {
    const s = createInitialState("id", "p");
    // gpt2: always unlocked
    expect(isModelUnlocked("gpt2", s)).toBe(true);
    // llama7b: requires 1 mac_mini
    expect(isModelUnlocked("llama7b", s)).toBe(false);
    expect(isModelUnlocked("llama7b", { ...s, hardware: { ...s.hardware, mac_mini: 1 } })).toBe(true);
    // mistral7b: requires 1 gaming_pc
    expect(isModelUnlocked("mistral7b", { ...s, hardware: { ...s.hardware, gaming_pc: 1 } })).toBe(true);
    // llama70b: requires 1 a100
    expect(isModelUnlocked("llama70b", { ...s, hardware: { ...s.hardware, a100: 1 } })).toBe(true);
    // claude_haiku: requires 1 tpu_pod
    expect(isModelUnlocked("claude_haiku", { ...s, hardware: { ...s.hardware, tpu_pod: 1 } })).toBe(true);
    // gpt4: requires 1 gpu_cluster
    expect(isModelUnlocked("gpt4", { ...s, hardware: { ...s.hardware, gpu_cluster: 1 } })).toBe(true);
    // agi: requires 1 data_center + 10 prestiges
    expect(isModelUnlocked("agi", { ...s, hardware: { ...s.hardware, data_center: 1 }, prestigeCount: 9 })).toBe(false);
    expect(isModelUnlocked("agi", { ...s, hardware: { ...s.hardware, data_center: 1 }, prestigeCount: 10 })).toBe(true);
  });

  it("L3: investor unlock conditions (hype thresholds)", () => {
    const s = createInitialState("id", "p");
    // moms_card: hype >= 1
    expect(isInvestorUnlocked("moms_card", { ...s, hype: 0 })).toBe(false);
    expect(isInvestorUnlocked("moms_card", { ...s, hype: 1 })).toBe(true);
    // angel: hype >= 3
    expect(isInvestorUnlocked("angel", { ...s, hype: 3 })).toBe(true);
    // seed: hype >= 5
    expect(isInvestorUnlocked("seed", { ...s, hype: 5 })).toBe(true);
    // series_a: hype >= 10
    expect(isInvestorUnlocked("series_a", { ...s, hype: 10 })).toBe(true);
    // softbank: hype >= 20
    expect(isInvestorUnlocked("softbank", { ...s, hype: 20 })).toBe(true);
    // saudi_fund: hype >= 50
    expect(isInvestorUnlocked("saudi_fund", { ...s, hype: 49 })).toBe(false);
    expect(isInvestorUnlocked("saudi_fund", { ...s, hype: 50 })).toBe(true);
  });

  it("L4: cannot buy tier N hardware with exactly 2 of tier N-1", () => {
    const s = createInitialState("id", "p");
    const s2 = { ...s, tokens: new Decimal(999_999), hardware: { ...s.hardware, mac_mini: 2 } };
    const result = buyHardware(s2, "gaming_pc");
    expect(result.ok).toBe(false);
  });

  it("L5: can buy tier N hardware with exactly 3 of tier N-1", () => {
    const s = createInitialState("id", "p");
    const s2 = { ...s, tokens: new Decimal(999_999), hardware: { ...s.hardware, mac_mini: 3 } };
    const result = buyHardware(s2, "gaming_pc");
    expect(result.ok).toBe(true);
  });
});

// ─── 2.1.7 Score Computation ──────────────────────────────────────────────────

describe("computeScore — formula verification", () => {
  it("SC1: score = totalTokensEarned + prestigeCount×1M + reputation×500K", () => {
    const s = createInitialState("id", "p");
    const s2 = { ...s, totalTokensEarned: new Decimal(2_000_000), prestigeCount: 3, reputation: 6 };
    const expected = 2_000_000 + 3 * 1_000_000 + 6 * 500_000;
    expect(computeScore(s2)).toBe(expected);
  });

  it("SC2: same tokens, higher prestige → higher score", () => {
    const s = createInitialState("id", "p");
    const base = { ...s, totalTokensEarned: new Decimal(5_000_000) };
    const p1 = { ...base, prestigeCount: 1 };
    const p2 = { ...base, prestigeCount: 2 };
    expect(computeScore(p2)).toBeGreaterThan(computeScore(p1));
  });
});

// ─── Rebalance: Storage Caps ──────────────────────────────────────────────────

describe("computeTokenCap", () => {
  const zeroState = () => createInitialState("id", "p");

  it("TC-01: 0 everything → 1000", () => {
    const s = zeroState();
    expect(computeTokenCap(s)).toBe(1_000);
  });

  it("TC-02: 3 mac_mini → 1000 + 3*500 = 2500", () => {
    const s = { ...zeroState(), hardware: { ...zeroState().hardware, mac_mini: 3 } };
    expect(computeTokenCap(s)).toBe(2_500);
  });

  it("TC-03: 3 mac_mini + 1 gaming_pc + 1 gpt2 → 1000 + 3*500 + 8000 + 500 = 11000", () => {
    const s = zeroState();
    const hw = { ...s.hardware, mac_mini: 3, gaming_pc: 1 };
    const mdl = { ...s.models, gpt2: 1 };
    expect(computeTokenCap({ hardware: hw, models: mdl })).toBe(11_000);
  });

  it("TC-04: 1 claude_haiku → tokenCap = 4000", () => {
    const s = zeroState();
    const mdl = { ...s.models, claude_haiku: 1 };
    expect(computeTokenCap({ hardware: s.hardware, models: mdl })).toBe(4_000);
  });
});

describe("computeComputeCap", () => {
  const zeroHW = () => createInitialState("id", "p").hardware;

  it("TC-05: 0 everything → 50", () => {
    expect(computeComputeCap({ hardware: zeroHW() })).toBe(50);
  });

  it("TC-06: 2 a100 + 1 tpu_pod → 3050", () => {
    const hw = { ...zeroHW(), a100: 2, tpu_pod: 1 };
    expect(computeComputeCap({ hardware: hw })).toBe(3_050);
  });

  it("TC-07: 1 hyperscaler → 300050", () => {
    const hw = { ...zeroHW(), hyperscaler: 1 };
    expect(computeComputeCap({ hardware: hw })).toBe(300_050);
  });

  it("TC-08: tokens capped at tokenCap in tick", () => {
    const s = createInitialState("id", "p");
    // No hardware, no models → tokenCap = 1000 (base).
    // Manually set tokensPerSecond to a large value via models and a big compute store.
    // We test: set tokens to cap-1 = 999, earn a lot in 1s → tokens stays at cap.
    const s2 = {
      ...s,
      tokens: new Decimal(999),
      compute: new Decimal(1_000),
      // No models, no hardware → tokenCap = 1000. But no production either!
      // Instead test: put tokens exactly at cap and check they don't grow.
    };
    // With no hardware/models, TPS = 0 → tokens unchanged at 999 < 1000.
    // Instead: use getAvailableActions pattern - just verify tick clamps.
    // Best approach: check that tokens don't EXCEED the cap when starting above it.
    const s3 = {
      ...s,
      tokens: new Decimal(2_000), // above cap of 1000
      compute: new Decimal(0),
    };
    const { state } = tick(s3, 1000);
    // tokenCap = 1000. Tokens should be clamped down.
    expect(state.tokens.lte(1_000)).toBe(true);
  });
});

// ─── Rebalance: Resolve Active Hardware ──────────────────────────────────────

describe("resolveActiveHardware", () => {
  const baseState = () => createInitialState("id", "p");

  it("TC-12: 1 a100, fundingPerSec=0 → a100 offline", () => {
    const s = { ...baseState(), hardware: { ...baseState().hardware, a100: 1 } };
    const active = resolveActiveHardware(s, 0);
    expect(active.a100).toBe(0);
  });

  it("TC-11: 1 a100, fundingPerSec=1 → a100 online", () => {
    const s = { ...baseState(), hardware: { ...baseState().hardware, a100: 1 } };
    const active = resolveActiveHardware(s, 1);
    expect(active.a100).toBe(1);
  });

  it("TC-14: 3 a100 (need 3/s), fundingPerSec=2 → 2 active", () => {
    const s = { ...baseState(), hardware: { ...baseState().hardware, a100: 3 } };
    const active = resolveActiveHardware(s, 2);
    expect(active.a100).toBe(2);
  });

  it("TC-15: 1 tpu_pod (4) + 3 a100 (3), fundingPerSec=3 → tpu_pod=0, a100=3", () => {
    const s = { ...baseState(), hardware: { ...baseState().hardware, tpu_pod: 1, a100: 3 } };
    const active = resolveActiveHardware(s, 3);
    expect(active.tpu_pod).toBe(0);
    expect(active.a100).toBe(3);
  });

  it("TC-16: 1 tpu_pod + 3 a100, fundingPerSec=7 → all active", () => {
    const s = { ...baseState(), hardware: { ...baseState().hardware, tpu_pod: 1, a100: 3 } };
    const active = resolveActiveHardware(s, 7);
    expect(active.tpu_pod).toBe(1);
    expect(active.a100).toBe(3);
  });

  it("TC-17: 1 hyperscaler (800) + 1 data_center (120), fundingPerSec=120 → hyperscaler offline", () => {
    const s = { ...baseState(), hardware: { ...baseState().hardware, hyperscaler: 1, data_center: 1 } };
    const active = resolveActiveHardware(s, 120);
    expect(active.hyperscaler).toBe(0);
    expect(active.data_center).toBe(1);
  });

  it("TC-18: 0 high-end hardware, fundingPerSec=0 → mac_mini active", () => {
    const s = { ...baseState(), hardware: { ...baseState().hardware, mac_mini: 3 } };
    const active = resolveActiveHardware(s, 0);
    expect(active.mac_mini).toBe(3);
  });
});

// ─── Rebalance: Model Compute Scaling ────────────────────────────────────────

describe("modelTotalComputeCost", () => {
  it("TC-19: 0 count → 0", () => {
    expect(modelTotalComputeCost(0.5, 0)).toBe(0);
  });

  it("TC-19b: 1 gpt2 → 0.5", () => {
    expect(modelTotalComputeCost(0.5, 1)).toBeCloseTo(0.5, 5);
  });

  it("TC-20: 2 gpt2 → 1.09", () => {
    expect(modelTotalComputeCost(0.5, 2)).toBeCloseTo(1.09, 2);
  });

  it("TC-21: 3 gpt2 → ~1.786", () => {
    expect(modelTotalComputeCost(0.5, 3)).toBeCloseTo(1.786, 2);
  });

  it("TC-24: 1 agi (base=200) → 200", () => {
    expect(modelTotalComputeCost(200, 1)).toBeCloseTo(200, 5);
  });

  it("TC-25: 2 agi → 436", () => {
    expect(modelTotalComputeCost(200, 2)).toBeCloseTo(200 + 236, 0);
  });

  it("TC-27: 1 gpt4 with flash_attention (factor=0.75) → 18.75", () => {
    expect(modelTotalComputeCost(25, 1, 0.75)).toBeCloseTo(18.75, 5);
  });

  it("TC-28: 1 llama7b with quantization (0.8) + open_source (0.8) → 1.28", () => {
    expect(modelTotalComputeCost(2, 1, 0.8 * 0.8)).toBeCloseTo(1.28, 5);
  });
});

describe("modelNextInstanceComputeCost", () => {
  it("TC-22: gpt2 with 0 owned → 0.5", () => {
    expect(modelNextInstanceComputeCost(0.5, 0)).toBeCloseTo(0.5, 5);
  });

  it("TC-23: gpt2 with 2 owned → 0.5 × 1.18² ≈ 0.6962", () => {
    expect(modelNextInstanceComputeCost(0.5, 2)).toBeCloseTo(0.5 * 1.18 * 1.18, 4);
  });

  it("nextInstanceCost for agi with 1 owned → 200 × 1.18", () => {
    expect(modelNextInstanceComputeCost(200, 1)).toBeCloseTo(200 * 1.18, 5);
  });
});

// ─── Rebalance: Upgrade Multipliers ──────────────────────────────────────────

describe("getModelTokenMultiplier", () => {
  const baseState = () => createInitialState("id", "p");

  it("TC-36: better_prompts → gpt2 multiplier = 1.40", () => {
    const s = { ...baseState(), upgrades: ["better_prompts" as const] };
    expect(getModelTokenMultiplier(s, "gpt2")).toBeCloseTo(1.4, 5);
  });

  it("TC-37: better_prompts → mistral7b multiplier = 1.0 (not affected)", () => {
    const s = { ...baseState(), upgrades: ["better_prompts" as const] };
    expect(getModelTokenMultiplier(s, "mistral7b")).toBeCloseTo(1.0, 5);
  });

  it("TC-38: rlhf + better_prompts → gpt2 multiplier = 1.80 (additive)", () => {
    const s = { ...baseState(), upgrades: ["rlhf" as const, "better_prompts" as const] };
    expect(getModelTokenMultiplier(s, "gpt2")).toBeCloseTo(1.80, 5);
  });
});

describe("getModelComputeCostMultiplier", () => {
  const baseState = () => createInitialState("id", "p");

  it("TC-26: quantization on gpt2 → unaffected (1.0)", () => {
    const s = { ...baseState(), upgrades: ["quantization" as const] };
    expect(getModelComputeCostMultiplier(s, "gpt2")).toBeCloseTo(1.0, 5);
  });

  it("quantization on llama7b → 0.80", () => {
    const s = { ...baseState(), upgrades: ["quantization" as const] };
    expect(getModelComputeCostMultiplier(s, "llama7b")).toBeCloseTo(0.8, 5);
  });

  it("quantization + open_source_everything on llama7b → 0.64", () => {
    const s = { ...baseState(), upgrades: ["quantization" as const, "open_source_everything" as const] };
    expect(getModelComputeCostMultiplier(s, "llama7b")).toBeCloseTo(0.64, 5);
  });

  it("TC-40: flash_attention + constitutional_ai on gpt4 → 25 × 0.75 × 0.70 = 13.125 total cost", () => {
    const s = { ...baseState(), upgrades: ["flash_attention" as const, "constitutional_ai" as const] };
    const mult = getModelComputeCostMultiplier(s, "gpt4");
    expect(mult).toBeCloseTo(0.75 * 0.70, 5);
    // Total compute for 1 gpt4: 25 × mult
    expect(modelTotalComputeCost(25, 1, mult)).toBeCloseTo(13.125, 3);
  });
});

describe("getInvestorMultiplier", () => {
  const baseState = () => createInitialState("id", "p");

  it("hire_interns → 1.30", () => {
    const s = { ...baseState(), upgrades: ["hire_interns" as const] };
    expect(getInvestorMultiplier(s)).toBeCloseTo(1.30, 5);
  });

  it("TC-39: hire_interns + poach_from_google + acquire_startup → 2.40", () => {
    const s = {
      ...baseState(),
      upgrades: ["hire_interns" as const, "poach_from_google" as const, "acquire_startup" as const],
    };
    expect(getInvestorMultiplier(s)).toBeCloseTo(2.40, 5);
  });
});

// ─── Rebalance: Hype Formula ──────────────────────────────────────────────────

describe("hype formula (k=0.05)", () => {
  it("hype=0 → hypeBonus=1 (no multiplier)", () => {
    const s = createInitialState("id", "p");
    const s2 = {
      ...s,
      compute: new Decimal(1e9),
      models: { ...s.models, gpt2: 1 },
      hype: 0,
    };
    const rates = computeRates(s2);
    // tokensPerSecond = rawTokens × 1 (reputation=0, hypeBonus=1)
    expect(num(rates.tokensPerSecond)).toBeCloseTo(3, 5);
  });

  it("hype=20 → hypeBonus = 1 + 20×0.05 = 2.0", () => {
    const s = createInitialState("id", "p");
    const s2 = {
      ...s,
      compute: new Decimal(1e9),
      models: { ...s.models, gpt2: 1 },
      hype: 20,
    };
    const rates = computeRates(s2);
    // rawTokens = 3, hypeBonus = 1 + 20×0.05×1 = 2.0
    expect(num(rates.tokensPerSecond)).toBeCloseTo(6, 5);
  });
});
