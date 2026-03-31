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
} from "./engine.js";
import { PRESTIGE_TOKEN_THRESHOLD } from "@ai-hype/shared";

describe("createInitialState", () => {
  it("creates a zeroed state", () => {
    const s = createInitialState("id1", "Alice");
    expect(s.tokens).toBe(0);
    expect(s.compute).toBe(0);
    expect(s.hype).toBe(0);
    expect(s.funding).toBe(0);
    expect(s.prestigeCount).toBe(0);
    expect(s.upgrades).toHaveLength(0);
    expect(s.milestonesHit).toHaveLength(0);
  });
});

describe("producerCost", () => {
  it("first unit costs base", () => {
    expect(producerCost(100, 0)).toBe(100);
  });

  it("second unit costs more", () => {
    expect(producerCost(100, 1)).toBeCloseTo(115, 0);
  });

  it("bulk cost is sum of individual costs", () => {
    const single1 = producerCost(100, 0);
    const single2 = producerCost(100, 1);
    const bulk = producerCost(100, 0, 2);
    expect(bulk).toBeCloseTo(single1 + single2, 5);
  });
});

describe("computeRates", () => {
  it("zero rates on fresh state", () => {
    const s = createInitialState("id", "p");
    const rates = computeRates(s);
    expect(rates.tokensPerSecond).toBe(0);
    expect(rates.computePerSecond).toBe(0);
    expect(rates.fundingPerSecond).toBe(0);
    expect(rates.clickPower).toBe(1);
  });

  it("hardware generates compute", () => {
    const s = createInitialState("id", "p");
    const s2 = { ...s, hardware: { ...s.hardware, mac_mini: 2 } };
    const rates = computeRates(s2);
    expect(rates.computePerSecond).toBe(2); // 2 × 1 compute/s
  });

  it("model generates tokens when compute is available", () => {
    const s = createInitialState("id", "p");
    const s2 = {
      ...s,
      compute: 100,
      hardware: { ...s.hardware, mac_mini: 5 },
      models: { ...s.models, gpt2: 1 },
    };
    const rates = computeRates(s2);
    expect(rates.tokensPerSecond).toBeGreaterThan(0);
  });

  it("hype multiplies token output", () => {
    const s = createInitialState("id", "p");
    const base = {
      ...s,
      compute: 100,
      hardware: { ...s.hardware, mac_mini: 5 },
      models: { ...s.models, gpt2: 1 },
    };
    const withHype = { ...base, hype: 2 };
    const ratesBase = computeRates(base);
    const ratesHype = computeRates(withHype);
    expect(ratesHype.tokensPerSecond).toBeGreaterThan(ratesBase.tokensPerSecond);
  });
});

describe("tick", () => {
  it("does nothing at zero rates", () => {
    const s = createInitialState("id", "p");
    const { state } = tick(s, 1000);
    expect(state.tokens).toBe(0);
  });

  it("advances tokens over time", () => {
    const s = createInitialState("id", "p");
    const s2 = {
      ...s,
      compute: 1000,
      hardware: { ...s.hardware, mac_mini: 5 },
      models: { ...s.models, gpt2: 1 },
    };
    const { state } = tick(s2, 1000); // 1 second
    expect(state.tokens).toBeGreaterThan(0);
    expect(state.totalTokensEarned).toBeGreaterThan(0);
  });

  it("triggers milestone at correct threshold", () => {
    const s = createInitialState("id", "p");
    const s2 = { ...s, totalTokensEarned: 999, tokens: 2 };
    // Simulate enough tokens flowing to cross 1k milestone
    const s3 = {
      ...s2,
      compute: 1000,
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
      totalTokensEarned: 5000,
      milestonesHit: ["m1k" as const],
      compute: 1000,
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
    expect(s2.tokens).toBe(1);
    expect(s2.totalClicks).toBe(1);
  });

  it("multi-click works", () => {
    const s = createInitialState("id", "p");
    const s2 = click(s, 10);
    expect(s2.tokens).toBe(10);
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
    const s2 = { ...s, tokens: 100 };
    const result = buyHardware(s2, "mac_mini");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.hardware.mac_mini).toBe(1);
      expect(result.state.tokens).toBeLessThan(100);
    }
  });

  it("fails if not unlocked", () => {
    const s = createInitialState("id", "p");
    const s2 = { ...s, tokens: 999_999 };
    // gaming_pc requires 3x mac_mini
    const result = buyHardware(s2, "gaming_pc");
    expect(result.ok).toBe(false);
  });

  it("unlocks when condition met", () => {
    const s = createInitialState("id", "p");
    const s2 = { ...s, tokens: 999_999, hardware: { ...s.hardware, mac_mini: 3 } };
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
    const s2 = { ...s, tokens: 1000 };
    const result = buyModel(s2, "gpt2");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.models.gpt2).toBe(1);
  });
});

describe("buyInvestor", () => {
  it("fails if hype too low", () => {
    const s = createInitialState("id", "p");
    const s2 = { ...s, tokens: 99_999, hype: 0 };
    const result = buyInvestor(s2, "moms_card");
    expect(result.ok).toBe(false);
  });

  it("succeeds when hype unlocks it", () => {
    const s = createInitialState("id", "p");
    const s2 = { ...s, tokens: 99_999, hype: 1 };
    const result = buyInvestor(s2, "moms_card");
    expect(result.ok).toBe(true);
  });
});

describe("buyUpgrade", () => {
  it("applies click multiplier", () => {
    const s = createInitialState("id", "p");
    const s2 = { ...s, tokens: 10_000 };
    const result = buyUpgrade(s2, "better_prompts");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.upgrades).toContain("better_prompts");
      expect(result.state.clickPower).toBe(2);
    }
  });

  it("cannot buy same upgrade twice", () => {
    const s = createInitialState("id", "p");
    const s2 = { ...s, tokens: 10_000, upgrades: ["better_prompts" as const] };
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
      tokens: 5_000_000,
      totalTokensEarned: PRESTIGE_TOKEN_THRESHOLD + 1,
      hardware: { ...s.hardware, mac_mini: 5 },
    };
    const result = prestige(s2);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.tokens).toBe(0);
      expect(result.state.hardware.mac_mini).toBe(0);
      expect(result.state.prestigeCount).toBe(1);
      expect(result.state.reputation).toBeGreaterThan(0);
    }
  });
});

describe("getAvailableActions", () => {
  it("returns affordable hardware at start", () => {
    const s = createInitialState("id", "p");
    const s2 = { ...s, tokens: 100 };
    const actions = getAvailableActions(s2);
    const mac = actions.find((a) => a.id === "mac_mini");
    expect(mac).toBeDefined();
    expect(mac?.affordable).toBe(true);
  });

  it("sorts affordable before unaffordable", () => {
    const s = createInitialState("id", "p");
    const s2 = { ...s, tokens: 50 }; // can afford mac_mini (10) but not gpt2 (50... borderline)
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
    const s2 = { ...s, totalTokensEarned: 1_000_000 };
    expect(computeScore(s2)).toBeGreaterThan(0);
  });

  it("prestige count adds to score", () => {
    const s = createInitialState("id", "p");
    const s2 = { ...s, prestigeCount: 1 };
    expect(computeScore(s2)).toBe(1_000_000);
  });
});
