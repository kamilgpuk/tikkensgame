# T'kkens Rebalance Spec

**Version:** 1.0  
**Date:** 2026-04-07  
**Status:** Pending implementation

---

## Table of Contents

1. [Overview & Goals](#1-overview--goals)
2. [New Resource Flow](#2-new-resource-flow)
3. [Storage Caps](#3-storage-caps)
4. [Hardware — Compute Production & Funding Running Costs](#4-hardware--compute-production--funding-running-costs)
5. [Model Compute Consumption — Per-Instance Scaling](#5-model-compute-consumption--per-instance-scaling)
6. [Price Scaling — Tiered Ratios](#6-price-scaling--tiered-ratios)
7. [Upgrades — Reworked Effects & Costs](#7-upgrades--reworked-effects--costs)
8. [Implementation Stages](#8-implementation-stages)
9. [Test Cases](#9-test-cases)
10. [UI Changes](#10-ui-changes)
11. [MCP Tool Updates](#11-mcp-tool-updates)
12. [Open Questions](#12-open-questions)

---

## 1. Overview & Goals

The current game has two problems:

1. **Flat progression**: compute generation is never constrained by anything except token cost; models never become expensive to run, so once you have hardware the compute just accumulates indefinitely.
2. **Blunt upgrades**: multipliers apply globally ("all models ×5"), removing strategic choice.

This rebalance introduces:
- A **funding dependency** for high-end hardware (A100+). Without funding, expensive hardware goes offline.
- **Compute caps** that increase only when you invest in compute-heavy hardware, forcing real resource management.
- **Per-instance scaling** of model compute consumption (each copy costs ×1.18 more than the last), making mass-buying models expensive in compute, not just tokens.
- **Tiered price scaling** ratios (higher tiers scale faster).
- **Targeted upgrade effects** (specific model tiers instead of "all"), creating genuine build choices.

---

## 2. New Resource Flow

```
Investors
    │
    └─► funding/s
              │
              └─► sustains high-end hardware (A100, TPU Pod, GPU Cluster, Data Center, Hyperscaler)
                        │
                        ▼
ALL hardware (incl. Mac Mini, Gaming PC) ──► compute/s ──► sustains models
                                                                │
                                                                ▼
                                                           models ──► tokens/s
```

### Dependency rules

**Funding → Hardware:**
- Every tick, the engine sums the total `fundingRunningCost/s` across all owned high-end hardware units.
- If `funding < totalFundingRunning Cost × tickElapsed`, hardware units go offline, starting from the most expensive (highest `fundingRunningCost`) first, until total running cost ≤ available funding rate.
- Offline hardware produces **zero compute**.
- Hardware comes back online automatically the next tick if funding recovers.

**Compute → Models:**
- Every tick, the engine sums compute consumed per second by all active model instances.
- If compute generated (net) is insufficient, models go offline starting from the most expensive (highest per-instance compute cost, accounting for scaling) first, until total consumption ≤ compute available.
- Offline models produce **zero tokens**.
- Models come back online automatically when compute recovers.

### Current implementation vs. new

The current engine (`computeRates` in `server/src/game/engine.ts`) computes a `utilisation` ratio — a 0–1 scalar applied to all models proportionally. **Replace this** with the discrete offline-first logic described above.

Current compute utilisation:
```ts
// OLD — proportional slowdown
const utilisation = totalComputeNeeded.gt(0)
  ? Decimal.min(D1, computeAvailable.div(totalComputeNeeded))
  : D1;
```

New logic: binary on/off per hardware unit and per model instance, with most-expensive-first shutdown order.

**Decision:** offline status is recomputed each tick. Not stored in `GameState`.

### 2.1 Hype — production multiplier scaled down

Hype is **retained** as a mechanic. It gates investors (unchanged) and multiplies token production. The formula changes only in magnitude:

```
// OLD
hypeBonus = 1 + hype × hypeMult

// NEW
hypeBonus = 1 + hype × 0.05 × hypeMult
```

The constant `k = 0.05` reduces the per-point contribution from 100% to 5%.

| Scenario | Old multiplier | New multiplier |
|---|---|---|
| All milestones, no upgrades (53.5 hype) | 54.5× | 3.7× |
| + Hype Machine ×2 (107 hype) | 108× | 6.4× |
| + Go Viral ×5 (267 hype) | 268× | 14.4× |
| + AGI Safety Theater ×3 hypeMult | 161× | 9.1× |

Hype Machine and Go Viral retain their existing `hypeMilestoneMultiplier` effect type — no change to upgrade definitions. AGI Safety Theater retains its `hypeMultiplier: 3` — no change. Only the engine formula constant changes.

---

## 3. Storage Caps

Both tokens and compute now have a hard cap. Production halts once the cap is reached. This prevents infinite accumulation and creates meaningful upgrade decisions (buy compute hardware to unlock higher-tier models).

### Token cap

```
tokenCap = 1,000 (base)
         + 300  × hardware.mac_mini
         + 1,000 × hardware.gaming_pc
         + 500 × modelTier(m) × models[m]   for each model m
```

Model tiers for token cap calculation:

| Model | Tier |
|---|---|
| GPT-2 | 1 |
| Llama 7B | 2 |
| Mistral 7B | 3 |
| Llama 70B | 4 |
| GPT-4 | 5 |
| Claude Haiku | 6 |
| AGI | 7 |

**Example:** 3 Mac Minis + 2 GPT-2 + 1 Llama 7B  
= 1000 + (3×300) + (2×500×1) + (1×500×2)  
= 1000 + 900 + 1000 + 1000 = **3,900 tokens**

### Compute cap

```
computeCap = 50 (base)
           + 500    × hardware.a100
           + 2,000  × hardware.tpu_pod
           + 10,000 × hardware.gpu_cluster
           + 50,000 × hardware.data_center
           + 300,000 × hardware.hyperscaler
```

Mac Mini and Gaming PC do NOT contribute to the compute cap (they're entry-level and the cap is meant to gate model slots).

**Example:** 2 A100 + 1 TPU Pod  
= 50 + (2×500) + (1×2000) = **3,050 compute**

### Cap enforcement

In `tick()`:
```ts
const tokenCap = computeTokenCap(state);
const computeCap = computeComputeCap(state);

tokens = Decimal.min(new Decimal(tokenCap), tokens);
compute = Decimal.min(new Decimal(computeCap), compute);
```

When tokens are at cap, `tokensPerSecond` still shows the rate — but tokens stop accumulating. Visually display "FULL" indicator.

**Decision:** Yes — milestone tracking uses `totalTokensEarned`, not current balance. No change needed.

---

## 4. Hardware — Compute Production & Funding Running Costs

All numbers are **per unit per second**.

### Current vs. new compute/s values

Current values (from `constants.ts`) are: mac_mini=1, gaming_pc=8, a100=60, tpu_pod=500, gpu_cluster=4000, data_center=35000, hyperscaler=400000.

**New values** are recalibrated downward to work with the new compute cap system:

| Hardware | ID | Old compute/s | New compute/s | Funding/s running cost |
|---|---|---|---|---|
| Mac Mini | `mac_mini` | 1 | 0.5 | 0 |
| Gaming PC | `gaming_pc` | 8 | 2 | 0 |
| A100 GPU | `a100` | 60 | 10 | 1 |
| TPU Pod | `tpu_pod` | 500 | 40 | 4 |
| GPU Cluster | `gpu_cluster` | 4,000 | 200 | 20 |
| Data Center | `data_center` | 35,000 | 1,000 | 120 |
| Hyperscaler | `hyperscaler` | 400,000 | 6,000 | 800 |

### `HardwareDef` type change

Add `fundingRunningCost` field to `HardwareDef` in `shared/src/types.ts`:

```ts
export interface HardwareDef {
  id: HardwareId;
  name: string;
  computePerSec: number;
  fundingRunningCost: number;  // NEW — funding/s consumed to keep this unit running
  baseCost: number;
  unlockCondition: { type: "start" } | { type: "ownHardware"; id: HardwareId; qty: number };
}
```

### Funding deficit → offline logic (engine)

In `computeRates()`, before computing compute generation:

```
1. Sum totalFundingNeeded = Σ (hardware[hw.id] × hw.fundingRunningCost) for all hw
2. If fundingPerSecond >= totalFundingNeeded → all hardware runs
3. If fundingPerSecond < totalFundingNeeded:
   a. Sort high-end hardware units by fundingRunningCost DESC
   b. Take units offline one by one (most expensive first) until
      remaining totalFundingNeeded <= fundingPerSecond
   c. Offline units contribute 0 compute/s
```

"Taking a unit offline" means excluding it from compute generation. If a hardware type has N units and some go offline, take whole units offline (not fractional), starting with that type if it has the highest cost per unit.

**Example:** 3 A100 (cost 1 each = 3 total), 1 TPU Pod (cost 4). Total funding needed = 7/s. If funding/s = 5:
- Take TPU Pod offline (saves 4, now need 3, have 5 ≥ 3 ✓)
- All 3 A100 stay online
- Active compute = 3 × 10 = 30/s (TPU = 0)

**Example 2:** funding/s = 2, 3 A100 running (need 3). Deficit = 1.
- Take 1 A100 offline (need 2, have 2 ✓)
- Active compute from A100 = 2 × 10 = 20/s

---

## 5. Model Compute Consumption — Per-Instance Scaling

Each additional instance of the same model costs ×1.18 more compute/s than the previous instance.

### Formula

For a model with base compute cost `c₀` and `n` total owned instances:

```
Total compute consumed by model = c₀ × Σ(1.18^i) for i in 0..n-1
                                 = c₀ × (1.18^n - 1) / (1.18 - 1)
                                 = c₀ × (1.18^n - 1) / 0.18
```

For display purposes, the **next instance cost** (instance `n+1`, zero-indexed `n`):
```
nextInstanceComputeCost = c₀ × 1.18^n
```

### Base rates (1st instance)

| Model | ID | Old compute/s | New base compute/s (1st instance) |
|---|---|---|---|
| GPT-2 | `gpt2` | 1 | 0.5 |
| Llama 7B | `llama7b` | 8 | 2 |
| Mistral 7B | `mistral7b` | 40 | 3 |
| Llama 70B | `llama70b` | 200 | 8 |
| GPT-4 | `gpt4` | 3,500 | 25 |
| Claude Haiku | `claude_haiku` | 800 | 50 |
| AGI | `agi` | 30,000 | 200 |

> Note: the existing `computePerSec` field on `ModelDef` becomes the **base rate for the 1st instance**. The engine must compute total consumed dynamically using the geometric formula rather than `count × baseCost`.

### `ModelDef` — no type change needed

`computePerSec` on `ModelDef` already represents the per-instance base. The engine implementation changes; the type can stay the same. Document this in a code comment.

### Upgrade interaction

Upgrades that reduce compute cost (e.g. Quantization, Flash Attention) apply as a multiplier to `c₀`, so:
```
effectiveC₀ = c₀ × computeCostMultiplier
totalConsumed = effectiveC₀ × (1.18^n - 1) / 0.18
```

`computeCostMultiplier` starts at 1.0 and is reduced by applicable upgrades:
- Quantization: −20% → multiply by 0.80 (Llama models only: llama7b, llama70b)
- Flash Attention: −25% → multiply by 0.75 (GPT-4, Claude Haiku)
- Open Source Everything: −20% → multiply by 0.80 (all models)
- Constitutional AI: −30% → multiply by 0.70 (all models)

Multipliers stack multiplicatively:
```
effectiveC₀(gpt4) with Flash Attention + Constitutional AI + Open Source Everything
= 25 × 0.75 × 0.70 × 0.80 = 10.5 compute/s for 1st instance
```

---

## 6. Price Scaling — Tiered Ratios

Current: flat `COST_SCALE = 1.15` for all producers.

New: per-category scaling stored in constants.

### New scaling ratios

| Category | Producers | New ratio |
|---|---|---|
| Entry hardware | Mac Mini, Gaming PC | 1.25 |
| Mid hardware | A100, TPU Pod | 1.35 |
| High-end hardware | GPU Cluster, Data Center, Hyperscaler | 1.45 |
| Models | All models | 1.30 |
| Investors | All investors | 1.20 |

### Implementation

Replace the single `COST_SCALE = 1.15` constant with a lookup function or per-def field.

Option A (recommended): add `costScale` field to each `HardwareDef`, `ModelDef`, `InvestorDef`:

```ts
export interface HardwareDef {
  // ...existing fields...
  costScale: number;  // NEW — e.g. 1.25 for mac_mini
}
```

Option B: a `getCostScale(type, id)` function in `constants.ts`.

Either way, `producerCost()` in `engine.ts` must accept (or look up) the scale:

```ts
export function producerCost(baseCost: number, owned: number, scale: number, quantity = 1): Decimal {
  if (quantity === 1) {
    return new Decimal(baseCost).mul(Decimal.pow(scale, owned));
  }
  return new Decimal(baseCost)
    .mul(Decimal.pow(scale, owned))
    .mul(Decimal.pow(scale, quantity).sub(1).div(scale - 1));
}
```

The client `ProducerPanel.tsx` also has its own hardcoded `scaledCost()` function using `1.15`. **This must be updated** to use per-type scaling too (or import a shared helper).

---

## 7. Upgrades — Reworked Effects & Costs

### New effect type: `modelComputeMultiplier`

Add to `UpgradeEffect` union in `types.ts`:

```ts
| { type: "modelComputeMultiplier"; modelIds: ModelId[]; factor: number }
| { type: "investorMultiplier"; factor: number }
```

`modelComputeMultiplier` reduces compute consumption (factor < 1) or increases it (factor > 1).

Also add `affectedModelIds` or `affectedInvestorIds` to existing effect types for partial targeting:

```ts
| { type: "modelMultiplier"; factor: number; modelIds?: ModelId[] }
// if modelIds is undefined → applies to all models (backward compat)
```

### Complete upgrade table

All token-cost upgrades now affect specific models. All funding-cost upgrades now affect investors or all models.

| ID | Name | Currency | New Cost | New Effect | Affected |
|---|---|---|---|---|---|
| `better_prompts` | Better Prompts | tokens | 75 | +40% tokens/s | gpt2, llama7b |
| `quantization` | Quantization | tokens | 1,500 | −20% compute cost | llama7b, llama70b |
| `prompt_engineering` | Prompt Engineering | tokens | 3,000 | +50% tokens/s | mistral7b, llama70b |
| `mixture_of_experts` | Mixture of Experts | tokens | 20,000 | +50% tokens/s | gpt4, claude_haiku |
| `flash_attention` | Flash Attention | tokens | 35,000 | −25% compute cost | gpt4, claude_haiku |
| `chain_of_thought` | Chain of Thought | tokens | 60,000 | +60% tokens/s | gpt4 |
| `rlhf` | RLHF | tokens | 300,000 | +40% tokens/s | all models |
| `constitutional_ai` | Constitutional AI | tokens | 6,000,000 | −30% compute cost | all models |
| `hype_machine` | Hype Machine | tokens | 700,000 | +50% tokens/s | all models |
| `go_viral` | Go Viral | tokens | 30,000,000 | +75% tokens/s | all models |
| `hire_interns` | Hire Interns | funding | 30 | +30% funding/s | all investors |
| `poach_from_google` | Poach from Google | funding | 300 | +50% funding/s | all investors |
| `open_source_everything` | Open Source Everything | funding | 3,000 | −20% compute cost | all models |
| `acquire_startup` | Acquire a Startup | funding | 25,000 | +60% funding/s | all investors |
| `agi_safety_theater` | AGI Safety Theater | funding | 300,000 | +50% tokens/s globally | all models |

### Effect semantics clarified

- `+X% tokens/s` → additive multiplier on `tokensPerSec` for targeted models. If multiple such upgrades apply to the same model, they stack additively: a model with +40% and +50% gets ×1.90, not ×1.40×1.50.
- `−X% compute cost` → multiplicative reduction on `computePerSec` base. Multiple cost-reduction upgrades multiply together: −20% and −30% = ×0.80×0.70 = ×0.56 (44% total reduction).
- `+X% funding/s` → additive multiplier on investor `fundingPerSec`. Same stacking rule: +30%, +50%, +60% = ×2.40 combined.

**Decision:** New effect types needed for `open_source_everything` and `acquire_startup`. Safe — upgrade effects are recomputed from IDs at runtime, not stored in save data.

### Old upgrade removal / repurposing

The old `clickMultiplier` upgrades (`better_prompts`, `prompt_engineering`, `chain_of_thought`) become `modelMultiplier` effects for specific tiers. The **click mechanic** loses its click-power upgrades. Click now always produces `clickPower = reputationMultiplier` tokens.

**Decision:** Click upgrades dropped entirely. No replacement.

---

## 8. Implementation Stages

### Stage 1 — Storage caps

**Files changed:**
- `shared/src/constants.ts`: add `computeTokenCap(state)` and `computeComputeCap(state)` exported functions. These take `GameState` and return `number`.
- `shared/src/types.ts`: no type changes required.
- `server/src/game/engine.ts`: call cap functions in `tick()`, clamp tokens and compute after accumulation.

**Functions to add in `constants.ts`:**
```ts
export const MODEL_TIERS: Record<ModelId, number> = {
  gpt2: 1, llama7b: 2, mistral7b: 3, llama70b: 4, gpt4: 5, claude_haiku: 6, agi: 7,
};

export function computeTokenCap(state: { hardware: Record<HardwareId, number>; models: Record<ModelId, number> }): number {
  let cap = 1_000;
  cap += state.hardware.mac_mini * 300;
  cap += state.hardware.gaming_pc * 1_000;
  for (const [id, tier] of Object.entries(MODEL_TIERS) as [ModelId, number][]) {
    cap += state.models[id] * 500 * tier;
  }
  return cap;
}

export function computeComputeCap(state: { hardware: Record<HardwareId, number> }): number {
  let cap = 50;
  cap += state.hardware.a100 * 500;
  cap += state.hardware.tpu_pod * 2_000;
  cap += state.hardware.gpu_cluster * 10_000;
  cap += state.hardware.data_center * 50_000;
  cap += state.hardware.hyperscaler * 300_000;
  return cap;
}
```

**Manual test:** buy 3 Mac Minis. Resource bar should show token cap of 1000 + 900 = 1900. Fill tokens to cap. Production should stop at cap.

**Unit tests to write:**
- `computeTokenCap` with 0 of everything → 1000
- `computeTokenCap` with 3 mac_minis, 0 else → 1900
- `computeTokenCap` with 3 mac_minis, 1 gaming_pc, 1 gpt2 → 1000 + 900 + 1000 + 500 = 3400
- `computeComputeCap` with 0 of everything → 50
- `computeComputeCap` with 2 a100, 1 tpu_pod → 50 + 1000 + 2000 = 3050
- `tick()` with tokens already at cap → tokens unchanged after tick

---

### Stage 2 — Compute production values

**Files changed:**
- `shared/src/constants.ts`: update `computePerSec` values in `HARDWARE` array to new values (see table in §4).

No engine logic changes — the formula is already `hardware[id] * hw.computePerSec`.

**Manual test:** buy 5 Mac Minis. `computePerSecond` should show +2.5.

**Unit tests:**
- `computeRates` with 5 mac_mini, 0 else → `computePerSecond = 2.5` (ignoring model consumption)
- `computeRates` with 1 gaming_pc, 0 else → `computePerSecond = 2`
- `computeRates` with 1 a100, 0 else → `computePerSecond = 10`

---

### Stage 3 — Funding running costs + offline logic

**Files changed:**
- `shared/src/types.ts`: add `fundingRunningCost: number` to `HardwareDef`.
- `shared/src/constants.ts`: populate `fundingRunningCost` on each hardware entry.
- `server/src/game/engine.ts`: replace compute utilisation ratio with discrete offline-first logic.

**New engine logic in `computeRates()`:**

```ts
function resolveActiveHardware(state: GameState, fundingPerSec: number): Record<HardwareId, number> {
  // Returns active unit counts after funding-based offline
  const active: Record<HardwareId, number> = { ...state.hardware };

  let totalFundingNeeded = 0;
  for (const hw of HARDWARE) {
    if (hw.fundingRunningCost > 0) {
      totalFundingNeeded += active[hw.id] * hw.fundingRunningCost;
    }
  }

  if (fundingPerSec >= totalFundingNeeded) return active;

  // Sort high-end hardware by cost DESC, take units offline
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
```

Similarly, `resolveActiveModels()` for compute-based offline (see §2).

**Manual test:** own 1 A100 (costs 1 funding/s), 0 investors → A100 offline indicator appears, compute from A100 = 0. Buy Mom's Credit Card (0.1 funding/s) — still offline. Buy 10 Mom's Credit Cards (1.0 funding/s) — A100 comes back online.

**Unit tests:**
- `resolveActiveHardware` with 1 a100, fundingPerSec=0 → active.a100 = 0
- `resolveActiveHardware` with 1 a100, fundingPerSec=1 → active.a100 = 1
- `resolveActiveHardware` with 3 a100, fundingPerSec=2 → active.a100 = 2 (one offline)
- `resolveActiveHardware` with 1 tpu_pod (cost 4) + 3 a100 (cost 3), fundingPerSec=3 → tpu_pod offline, 3 a100 active (need 3, have 3 ✓)
- `resolveActiveHardware` with 2 data_center (cost 240) + 1 hyperscaler (cost 800), fundingPerSec=240 → hyperscaler offline, both data_centers active

---

### Stage 4 — Model compute consumption scaling (×1.18 per instance)

**Files changed:**
- `shared/src/constants.ts`: update `computePerSec` base values in `MODELS` array to new values (see §5 table).
- `server/src/game/engine.ts`: replace flat `model.computePerSec × count` with geometric sum formula.

**New function in `engine.ts` or `constants.ts`:**

```ts
export const COMPUTE_SCALE_PER_INSTANCE = 1.18;

export function modelTotalComputeCost(
  baseComputePerSec: number,
  count: number,
  costMultiplier = 1.0
): number {
  if (count === 0) return 0;
  const effectiveBase = baseComputePerSec * costMultiplier;
  // Geometric sum: effectiveBase * (1.18^count - 1) / 0.18
  return effectiveBase * (Math.pow(COMPUTE_SCALE_PER_INSTANCE, count) - 1) / (COMPUTE_SCALE_PER_INSTANCE - 1);
}

export function modelNextInstanceComputeCost(
  baseComputePerSec: number,
  currentCount: number,
  costMultiplier = 1.0
): number {
  return baseComputePerSec * costMultiplier * Math.pow(COMPUTE_SCALE_PER_INSTANCE, currentCount);
}
```

**Manual test:** buy 3 GPT-2 instances. Compute consumed should be 0.5 + 0.59 + 0.6962 ≈ 1.786/s (not 1.5).

**Unit tests:**
- `modelTotalComputeCost(0.5, 0)` → 0
- `modelTotalComputeCost(0.5, 1)` → 0.5
- `modelTotalComputeCost(0.5, 2)` → 0.5 + 0.59 = 1.09
- `modelTotalComputeCost(0.5, 3)` → 0.5 + 0.59 + 0.6962 ≈ 1.7862
- `modelNextInstanceComputeCost(0.5, 0)` → 0.5
- `modelNextInstanceComputeCost(0.5, 2)` → 0.5 × 1.18² = 0.6962
- `modelTotalComputeCost(25, 1, 0.75)` → 25 × 0.75 = 18.75 (with Flash Attention)

---

### Stage 5 — Price ratio changes

**Files changed:**
- `shared/src/types.ts`: add `costScale: number` to `HardwareDef`, `ModelDef`, `InvestorDef`.
- `shared/src/constants.ts`: populate `costScale` on each producer definition; remove `COST_SCALE = 1.15`.
- `server/src/game/engine.ts`: `producerCost()` takes `scale` as argument; all callers pass `def.costScale`.
- `client/src/components/ProducerPanel.tsx`: update `scaledCost()` to use per-def scale.

**New constant values:**

```ts
// In HARDWARE array:
{ id: "mac_mini",     costScale: 1.25, ... }
{ id: "gaming_pc",    costScale: 1.25, ... }
{ id: "a100",         costScale: 1.35, ... }
{ id: "tpu_pod",      costScale: 1.35, ... }
{ id: "gpu_cluster",  costScale: 1.45, ... }
{ id: "data_center",  costScale: 1.45, ... }
{ id: "hyperscaler",  costScale: 1.45, ... }

// In MODELS array: all costScale: 1.30
// In INVESTORS array: all costScale: 1.20
```

**Manual test:** buy first Mac Mini (10 tokens). Buy second — should cost 10 × 1.25 = 12.5 tokens, not 11.5.

**Unit tests:**
- `producerCost(10, 0, 1.25, 1)` → 10
- `producerCost(10, 1, 1.25, 1)` → 12.5
- `producerCost(10, 2, 1.25, 1)` → 15.625
- `producerCost(2000, 0, 1.35, 1)` → 2000 (A100 first)
- `producerCost(2000, 1, 1.35, 1)` → 2700 (A100 second)
- `producerCost(50, 0, 1.30, 1)` → 50 (GPT-2 first)
- `producerCost(50, 1, 1.30, 1)` → 65 (GPT-2 second)

---

### Stage 6 — Upgrade effect rework

**Files changed:**
- `shared/src/types.ts`: add new effect types to `UpgradeEffect` union (see §7).
- `shared/src/constants.ts`: rewrite `UPGRADES` array with new costs, effects, and `modelIds` fields.
- `server/src/game/engine.ts`: update multiplier helper functions to handle targeted model effects.

**New multiplier helpers needed:**

```ts
// Replace getModelMultiplier(state) with:
function getModelTokenMultiplier(state: GameState, modelId: ModelId): number {
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

function getModelComputeCostMultiplier(state: GameState, modelId: ModelId): number {
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

function getInvestorMultiplier(state: GameState): number {
  let m = 1;
  for (const id of state.upgrades) {
    const def = UPGRADE_MAP[id];
    if (def.effect.type === "investorMultiplier") {
      m += def.effect.factor - 1; // additive stacking
    }
  }
  return m;
}
```

**Manual test:** buy Better Prompts → GPT-2 and Llama 7B tokens/s each increase by 40%. Mistral 7B unchanged. Then buy Prompt Engineering → Mistral 7B and Llama 70B increase by 50%. GPT-2 still only has +40%.

**Unit tests:**
- `getModelTokenMultiplier` with `better_prompts` purchased, for `gpt2` → 1.40
- `getModelTokenMultiplier` with `better_prompts` purchased, for `mistral7b` → 1.0
- `getModelTokenMultiplier` with `better_prompts` + `rlhf` purchased, for `gpt2` → 1.40 + 0.40 = 1.80 (additive)
- `getModelComputeCostMultiplier` with `quantization` purchased, for `llama7b` → 0.80
- `getModelComputeCostMultiplier` with `quantization` + `open_source_everything` purchased, for `llama7b` → 0.80 × 0.80 = 0.64
- `getModelComputeCostMultiplier` with `quantization` purchased, for `gpt2` → 1.0 (not affected)
- `getInvestorMultiplier` with `hire_interns` purchased → 1.30
- `getInvestorMultiplier` with `hire_interns` + `poach_from_google` purchased → 1.30 + 0.50 = 1.80 (additive)

---

### Stage 7 — UI updates

**Files changed:** see §10 for full list. This stage has no logic changes — purely display.

**Manual test:** resource bar shows compute with cap. Hardware panel shows offline state. Model panel shows compute cost scaling.

---

### Stage 8 — MCP tool updates

**Files changed:**
- `server/src/game/engine.ts`: update `getAvailableActions()` to include new fields.
- MCP server handler for `get_available_actions`.

See §11 for full field list.

---

## 9. Test Cases

All test cases use state values that make computation unambiguous. Hardware prices use the new `costScale` values.

### 9.1 Storage caps

| # | Scenario | Expected |
|---|---|---|
| TC-01 | 0 everything → tokenCap | 1,000 |
| TC-02 | 3 mac_mini, 0 else → tokenCap | 1,000 + 900 = 1,900 |
| TC-03 | 3 mac_mini, 1 gaming_pc, 1 gpt2 → tokenCap | 1,000 + 900 + 1,000 + 500 = 3,400 |
| TC-04 | 1 claude_haiku → tokenCap contribution | 500 × 6 = 3,000; total = 1,000 + 3,000 = 4,000 |
| TC-05 | 0 everything → computeCap | 50 |
| TC-06 | 2 a100, 1 tpu_pod → computeCap | 50 + 1,000 + 2,000 = 3,050 |
| TC-07 | 1 hyperscaler → computeCap | 50 + 300,000 = 300,050 |
| TC-08 | tokens = tokenCap, +100 tokens in tick → tokens unchanged at cap | tokens stays at tokenCap |

### 9.2 Hardware compute production

| # | Scenario | Expected computePerSecond |
|---|---|---|
| TC-09 | 5 mac_mini, 0 else | 5 × 0.5 = 2.5 |
| TC-10 | 1 gaming_pc, 0 else | 1 × 2 = 2.0 |
| TC-11 | 1 a100, 0 else, fundingPerSec=1 | 1 × 10 = 10.0 (online) |
| TC-12 | 1 a100, 0 else, fundingPerSec=0 | 0 (offline) |
| TC-13 | 2 mac_mini + 1 a100, fundingPerSec=0 | mac_mini produce 2×0.5=1.0; a100 offline → total 1.0 |

### 9.3 Funding running costs — offline logic

| # | Scenario | Expected |
|---|---|---|
| TC-14 | 3 a100 (need 3/s), fundingPerSec=2 → active a100 count | 2 (one offline) |
| TC-15 | 1 tpu_pod (need 4) + 3 a100 (need 3), fundingPerSec=3 → active | tpu_pod=0, a100=3 (cost=3, have 3) |
| TC-16 | 1 tpu_pod + 3 a100, fundingPerSec=7 → all active | tpu_pod=1, a100=3 |
| TC-17 | 1 hyperscaler (800) + 1 data_center (120), fundingPerSec=120 | hyperscaler offline; data_center active |
| TC-18 | 0 high-end hardware, fundingPerSec=0 | all hardware active (mac_mini, gaming_pc have no cost) |

### 9.4 Model compute consumption scaling

| # | Scenario | Expected total compute consumed |
|---|---|---|
| TC-19 | 1 gpt2 | 0.5 |
| TC-20 | 2 gpt2 | 0.5 + 0.59 = 1.09 |
| TC-21 | 3 gpt2 | 0.5 + 0.59 + 0.6962 ≈ 1.786 |
| TC-22 | nextInstanceComputeCost for gpt2 with 0 owned | 0.5 |
| TC-23 | nextInstanceComputeCost for gpt2 with 2 owned | 0.5 × 1.18² = 0.6962 |
| TC-24 | 1 agi | 200 |
| TC-25 | 2 agi | 200 + 236 = 436 |
| TC-26 | 1 gpt4, quantization purchased (−20% not applicable to gpt4) | 25 (unaffected) |
| TC-27 | 1 gpt4, flash_attention purchased | 25 × 0.75 = 18.75 |
| TC-28 | 1 llama7b, quantization + open_source_everything | 2 × 0.80 × 0.80 = 1.28 |

### 9.5 Price scaling

| # | Scenario | Expected cost |
|---|---|---|
| TC-29 | mac_mini 1st purchase (owned=0) | 10 |
| TC-30 | mac_mini 2nd purchase (owned=1) | 10 × 1.25 = 12.5 |
| TC-31 | mac_mini 3rd purchase (owned=2) | 10 × 1.25² = 15.625 |
| TC-32 | gpu_cluster 1st purchase (owned=0) | 300,000 |
| TC-33 | gpu_cluster 2nd purchase (owned=1) | 300,000 × 1.45 = 435,000 |
| TC-34 | gpt2 2nd purchase (owned=1) | 50 × 1.30 = 65 |
| TC-35 | moms_card 2nd purchase (owned=1, baseCost=500) | 500 × 1.20 = 600 |

### 9.6 Upgrade effects

| # | Scenario | Expected |
|---|---|---|
| TC-36 | `better_prompts` purchased; gpt2 tokensPerSec base=3 → effective | 3 × 1.40 = 4.2 |
| TC-37 | `better_prompts` purchased; mistral7b tokensPerSec → effective | unchanged (×1.0) |
| TC-38 | `rlhf` + `better_prompts` purchased; gpt2 tokens/s multiplier | 1 + 0.40 + 0.40 = 1.80 (additive) |
| TC-39 | `hire_interns` + `poach_from_google` + `acquire_startup`; fundingPerSec multiplier | 1 + 0.30 + 0.50 + 0.60 = 2.40 |
| TC-40 | `flash_attention` + `constitutional_ai` for gpt4 compute cost | 25 × 0.75 × 0.70 = 13.125 |

---

## 10. UI Changes

### `ResourceBar.tsx`

- **Tokens:** change format from `"1,240"` to `"1,240 / 2,000"` showing current/cap. Add `FULL` badge when at cap (styled in orange/red).
- **Compute:** same cap display — `"45.2 / 3,050"`. Keep existing negative-rate warning. Add `FULL` badge.
- **Rate display for compute:** show gross generated and gross consumed separately as a tooltip on hover: `"+10/s generated, −8.6/s consumed"`.
- **Funding:** add a warning indicator if `fundingPerSecond < totalFundingRunningCost` (hardware deficit incoming). Show `"⚠ hardware deficit"`.

### `ProducerPanel.tsx`

**Hardware section:**
- Detail line changes from `+N compute/s` to: `+N compute/s · $X/s cost` (for hardware with running cost > 0).
- For hardware with `fundingRunningCost = 0`: keep `+N compute/s` (no cost shown).
- Add offline indicator: if a hardware type has some units offline (due to funding deficit), show `[K offline]` in red next to owned count. Example: `×3 [1 offline]`.
- Base cost tooltip: when hovering cost button, show next instance compute/s change.

**Models section:**
- Detail line changes from `+T T/s · −C C/s` to include the **next instance compute cost**: `+T T/s · −C.CC C/s (next)`.
- "next" cost is `modelNextInstanceComputeCost(base, currentOwned, multiplier)`.
- Add offline indicator: if some model instances are offline, show count in red.
- Show the total compute currently consumed by all instances of that model.

**Investors section:**
- No structural change. Optionally show total funding/s contributed by each investor type.

### `UpgradePanel.tsx`

- Show which producers are affected under the upgrade name. Example: `"Better Prompts — affects: GPT-2, Llama 7B"`.
- For compute-cost upgrades: show the reduction percentage clearly: `"−20% compute: Llama models"`.
- Group upgrades by currency (tokens / funding) with visual separator.
- Show description that aligns with new effects (no more `"×5 tokens/s"` — instead `"+40% tokens/s: GPT-2, Llama 7B"`).

### New component: `OfflineWarningBanner` (optional)

If any hardware or models are offline, show a dismissable banner at the top of the producer panel:  
`"⚠ 1 A100 offline — need $1/s more funding to bring it back online."`

---

## 11. MCP Tool Updates

### `get_available_actions` — new fields on `ActionOption`

The current `ActionOption` type in `types.ts` needs additional fields to give the MCP agent enough information to make meaningful decisions in the new system.

```ts
export interface ActionOption {
  // ...existing fields unchanged...
  type: "hardware" | "model" | "investor" | "upgrade" | "prestige";
  id: string;
  name: string;
  cost: number;
  currency: "tokens" | "funding";
  affordable: boolean;
  tokensPerSecGain: number;
  paybackSeconds: number | null;
  unlocksNew: boolean;
  reputationGain?: number;
  newMultiplier?: number;

  // NEW fields:
  computePerSecGain?: number;         // for hardware: how much compute/s this adds (when online)
  fundingRunningCost?: number;         // for hardware: funding/s required to keep ONE unit running
  isOnline?: boolean;                  // for hardware/model: false if currently offline due to resource deficit
  offlineUnitsCount?: number;          // for hardware: how many of owned units are currently offline
  nextInstanceComputeCost?: number;    // for model: compute/s cost of the NEXT instance to buy
  totalComputeConsumed?: number;       // for model: total compute/s currently consumed by all owned instances
  computeCapIncrease?: number;         // for hardware: how much it increases computeCap
  tokenCapIncrease?: number;           // for hardware/model: how much it increases tokenCap
  fundingPerSecGain?: number;          // for investor: funding/s per new unit
}
```

### `get_game_state` — no schema changes needed

The existing `GameState` fields (`computePerSecond`, `fundingPerSecond`, etc.) remain. Caps are computable from hardware/model counts already in state. No new top-level state fields required unless the agent needs pre-computed cap values — if so, add:

```ts
// Optional additions to GameState or a new computed summary:
tokenCap?: number;
computeCap?: number;
totalFundingRunningCost?: number;  // sum of all running costs at current hardware levels
```

**Decision:** `tokenCap` and `computeCap` computed in `tick()` and stored as plain `number` fields in `GameState`. Avoids re-deriving client-side.

---

## 12. Resolved Decisions

All open questions closed as of 2026-04-07.

| # | Question | Decision |
|---|---|---|
| 1 | Offline tracking: recompute vs store in state | **Recompute each tick.** Avoids stale state bugs. |
| 2 | Clicks at token cap — count toward `totalTokensEarned`? | **Yes.** Milestone tracking uses `totalTokensEarned`, not balance. No change needed. |
| 3 | Can player buy A100 before having investors? | **Verified safe.** A100 requires 3 Gaming PCs → by that point ~5–15k total tokens earned → m1k + m10k hit → hype ≥ 1.5 → Seed investor already unlocked. Buying A100 before Angel investor (hype ≥ 3 = m100k) is possible but it goes offline immediately — intended "you're not ready" signal. |
| 4 | Click upgrades removed — add replacement? | **Drop entirely.** No replacement click upgrade. |
| 5 | Hype Machine / Go Viral — convert to token multipliers? | **Keep as hype multipliers.** Hype is retained as a mechanic. Hype Machine (×2 milestone hype gain) and Go Viral (×5 milestone hype gain) remain unchanged. |
| 6 | AGI Safety Theater — change from hypeMultiplier? | **Keep as hypeMultiplier (×3).** Hype is kept; AGI Safety Theater's role as a late-game hype amplifier is retained. With the new hype scaling constant k=0.05, its effective contribution is reasonable (see §2.1). |

---

## Appendix — Formula Reference

### Token cap
```
tokenCap = 1000 + 300×mac_mini + 1000×gaming_pc
         + Σ(500 × tier(m) × count(m)) for all models m
```

### Compute cap
```
computeCap = 50 + 500×a100 + 2000×tpu_pod + 10000×gpu_cluster
           + 50000×data_center + 300000×hyperscaler
```

### Model total compute consumed (n instances)
```
consumed(model, n) = c₀ × effectiveMult × (1.18^n - 1) / 0.18
```
where `effectiveMult` is the product of all active compute-reducing upgrade factors for that model.

### Model next instance compute cost
```
nextCost(model, n) = c₀ × effectiveMult × 1.18^n
```

### Producer cost (tiered scaling)
```
cost(baseCost, owned, scale) = baseCost × scale^owned
```
For bulk buy of qty:
```
cost(baseCost, owned, scale, qty) = baseCost × scale^owned × (scale^qty - 1) / (scale - 1)
```

### Token multiplier for a model (additive upgrades)
```
tokenMult(model) = 1 + Σ(effect.factor - 1) for each applicable upgrade
```

### Investor multiplier (additive)
```
investorMult = 1 + Σ(effect.factor - 1) for each investor upgrade
```

### Compute cost multiplier for a model (multiplicative)
```
computeCostMult(model) = Π(effect.factor) for each applicable compute-reduction upgrade
```
