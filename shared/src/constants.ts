import Decimal from "break_eternity.js";
import type {
  HardwareDef,
  ModelDef,
  InvestorDef,
  UpgradeDef,
  MilestoneDef,
  HardwareId,
  ModelId,
  InvestorId,
  UpgradeId,
  MilestoneId,
} from "./types.js";

// COST_SCALE removed — each producer now has its own costScale field (Stage 5)

// ─── Model compute scaling ────────────────────────────────────────────────────
// Each additional model instance costs ×1.18 more compute/s than the previous one.
export const COMPUTE_SCALE_PER_INSTANCE = 1.18;

/**
 * Total compute/s consumed by `count` instances of a model.
 * Uses geometric sum: effectiveBase × (1.18^count - 1) / 0.18
 */
export function modelTotalComputeCost(
  baseComputePerSec: number,
  count: number,
  costMultiplier = 1.0
): number {
  if (count === 0) return 0;
  const effectiveBase = baseComputePerSec * costMultiplier;
  return effectiveBase * (Math.pow(COMPUTE_SCALE_PER_INSTANCE, count) - 1) / (COMPUTE_SCALE_PER_INSTANCE - 1);
}

/**
 * Compute/s cost of the NEXT model instance (instance index `currentCount`, 0-indexed).
 */
export function modelNextInstanceComputeCost(
  baseComputePerSec: number,
  currentCount: number,
  costMultiplier = 1.0
): number {
  return baseComputePerSec * costMultiplier * Math.pow(COMPUTE_SCALE_PER_INSTANCE, currentCount);
}

// ─── Storage cap helpers ──────────────────────────────────────────────────────

export const MODEL_TIERS: Record<import("./types.js").ModelId, number> = {
  gpt2: 1, llama7b: 2, mistral7b: 3, llama70b: 4, gpt4: 5, claude_haiku: 6, agi: 7,
};

export function computeTokenCap(state: {
  hardware: Record<import("./types.js").HardwareId, number>;
  models: Record<import("./types.js").ModelId, number>;
}): number {
  let cap = 1_000;
  cap += state.hardware.mac_mini * 300;
  cap += state.hardware.gaming_pc * 1_000;
  for (const [id, tier] of Object.entries(MODEL_TIERS) as [import("./types.js").ModelId, number][]) {
    cap += state.models[id] * 500 * tier;
  }
  return cap;
}

export function computeComputeCap(state: {
  hardware: Record<import("./types.js").HardwareId, number>;
}): number {
  let cap = 50;
  cap += state.hardware.a100 * 500;
  cap += state.hardware.tpu_pod * 2_000;
  cap += state.hardware.gpu_cluster * 10_000;
  cap += state.hardware.data_center * 50_000;
  cap += state.hardware.hyperscaler * 300_000;
  return cap;
}

/** Token goal for prestige n (run 0 → 1M, run 1 → 10M, run 2 → 100M…) */
export function prestigeTokenThreshold(prestigeCount: number): Decimal {
  return new Decimal(1_000_000).mul(Decimal.pow(10, prestigeCount));
}

/** Funding required to prestige on run n (0 → 10k, 1 → 50k, 2 → 250k…) */
export function prestigeFundingThreshold(prestigeCount: number): Decimal {
  return new Decimal(10_000).mul(Decimal.pow(5, prestigeCount));
}

/** Token generation multiplier from reputation (sqrt curve, not linear) */
export function reputationMultiplier(reputation: number): number {
  return 1 + Math.sqrt(reputation) * 1.5;
}

// ─── Hardware ─────────────────────────────────────────────────────────────────

export const HARDWARE: HardwareDef[] = [
  {
    id: "mac_mini",
    name: "Mac Mini",
    computePerSec: 0.5,
    fundingRunningCost: 0,
    costScale: 1.25,
    baseCost: 10,
    unlockCondition: { type: "start" },
  },
  {
    id: "gaming_pc",
    name: "Gaming PC",
    computePerSec: 2,
    fundingRunningCost: 0,
    costScale: 1.25,
    baseCost: 150,
    unlockCondition: { type: "ownHardware", id: "mac_mini", qty: 3 },
  },
  {
    id: "a100",
    name: "A100 GPU",
    computePerSec: 10,
    fundingRunningCost: 1,
    costScale: 1.35,
    baseCost: 2_000,
    unlockCondition: { type: "ownHardware", id: "gaming_pc", qty: 3 },
  },
  {
    id: "tpu_pod",
    name: "TPU Pod",
    computePerSec: 40,
    fundingRunningCost: 4,
    costScale: 1.35,
    baseCost: 25_000,
    unlockCondition: { type: "ownHardware", id: "a100", qty: 3 },
  },
  {
    id: "gpu_cluster",
    name: "GPU Cluster",
    computePerSec: 200,
    fundingRunningCost: 20,
    costScale: 1.45,
    baseCost: 300_000,
    unlockCondition: { type: "ownHardware", id: "tpu_pod", qty: 3 },
  },
  {
    id: "data_center",
    name: "Data Center",
    computePerSec: 1_000,
    fundingRunningCost: 120,
    costScale: 1.45,
    baseCost: 4_000_000,
    unlockCondition: { type: "ownHardware", id: "gpu_cluster", qty: 3 },
  },
  {
    id: "hyperscaler",
    name: "Hyperscaler",
    computePerSec: 6_000,
    fundingRunningCost: 800,
    costScale: 1.45,
    baseCost: 60_000_000,
    unlockCondition: { type: "ownHardware", id: "data_center", qty: 3 },
  },
];

export const HARDWARE_MAP: Record<HardwareId, HardwareDef> = Object.fromEntries(
  HARDWARE.map((h) => [h.id, h])
) as Record<HardwareId, HardwareDef>;

// ─── Models ───────────────────────────────────────────────────────────────────

export const MODELS: ModelDef[] = [
  {
    id: "gpt2",
    name: "GPT-2",
    computePerSec: 0.5,
    tokensPerSec: 3,
    costScale: 1.30,
    baseCost: 50,
    unlockCondition: { type: "start" },
  },
  {
    id: "llama7b",
    name: "Llama 7B",
    computePerSec: 2,
    tokensPerSec: 30,
    costScale: 1.30,
    baseCost: 800,
    unlockCondition: { type: "ownHardware", id: "mac_mini", qty: 1 },
  },
  {
    id: "mistral7b",
    name: "Mistral 7B",
    computePerSec: 3,
    tokensPerSec: 180,
    costScale: 1.30,
    baseCost: 10_000,
    unlockCondition: { type: "ownHardware", id: "gaming_pc", qty: 1 },
  },
  {
    id: "llama70b",
    name: "Llama 70B",
    computePerSec: 8,
    tokensPerSec: 1_000,
    costScale: 1.30,
    baseCost: 120_000,
    unlockCondition: { type: "ownHardware", id: "a100", qty: 1 },
  },
  {
    id: "claude_haiku",
    name: "Claude Haiku",
    computePerSec: 50,
    tokensPerSec: 4_500,
    costScale: 1.30,
    baseCost: 1_500_000,
    unlockCondition: { type: "ownHardware", id: "tpu_pod", qty: 1 },
  },
  {
    id: "gpt4",
    name: "GPT-4",
    computePerSec: 25,
    tokensPerSec: 22_000,
    costScale: 1.30,
    baseCost: 20_000_000,
    unlockCondition: { type: "ownHardware", id: "gpu_cluster", qty: 1 },
  },
  {
    id: "agi",
    name: "AGI (????)",
    computePerSec: 200,
    tokensPerSec: 250_000,
    costScale: 1.30,
    baseCost: 500_000_000,
    unlockCondition: { type: "ownHardwareAndPrestige", id: "data_center", qty: 1, prestiges: 10 },
  },
];

export const MODEL_MAP: Record<ModelId, ModelDef> = Object.fromEntries(
  MODELS.map((m) => [m.id, m])
) as Record<ModelId, ModelDef>;

// ─── Investors ────────────────────────────────────────────────────────────────

export const INVESTORS: InvestorDef[] = [
  {
    id: "moms_card",
    name: "Mom's Credit Card",
    fundingPerSec: 0.1,
    costScale: 1.20,
    baseCost: 500,
    unlockCondition: { type: "hype", min: 1 },
  },
  {
    id: "angel",
    name: "Angel Investor",
    fundingPerSec: 0.6,
    costScale: 1.20,
    baseCost: 8_000,
    unlockCondition: { type: "hype", min: 3 },
  },
  {
    id: "seed",
    name: "Seed Round",
    fundingPerSec: 4,
    costScale: 1.20,
    baseCost: 100_000,
    unlockCondition: { type: "hype", min: 5 },
  },
  {
    id: "series_a",
    name: "Series A VC",
    fundingPerSec: 25,
    costScale: 1.20,
    baseCost: 1_500_000,
    unlockCondition: { type: "hype", min: 10 },
  },
  {
    id: "softbank",
    name: "SoftBank",
    fundingPerSec: 200,
    costScale: 1.20,
    baseCost: 30_000_000,
    unlockCondition: { type: "hype", min: 20 },
  },
  {
    id: "saudi_fund",
    name: "Saudi Sovereign Fund",
    fundingPerSec: 2_000,
    costScale: 1.20,
    baseCost: 800_000_000,
    unlockCondition: { type: "hype", min: 50 },
  },
];

export const INVESTOR_MAP: Record<InvestorId, InvestorDef> = Object.fromEntries(
  INVESTORS.map((i) => [i.id, i])
) as Record<InvestorId, InvestorDef>;

// ─── Upgrades ─────────────────────────────────────────────────────────────────

export const UPGRADES: UpgradeDef[] = [
  // ── Token-cost upgrades ─────────────────────────────────────────────────────
  {
    id: "better_prompts",
    name: "Better Prompts",
    description: "+40% tokens/s: GPT-2, Llama 7B",
    currency: "tokens",
    cost: 75,
    effect: { type: "modelMultiplier", factor: 1.4, modelIds: ["gpt2", "llama7b"] },
  },
  {
    id: "quantization",
    name: "Quantization",
    description: "−20% compute cost: Llama models",
    currency: "tokens",
    cost: 1_500,
    effect: { type: "modelComputeMultiplier", factor: 0.8, modelIds: ["llama7b", "llama70b"] },
  },
  {
    id: "prompt_engineering",
    name: "Prompt Engineering",
    description: "+50% tokens/s: Mistral 7B, Llama 70B",
    currency: "tokens",
    cost: 3_000,
    effect: { type: "modelMultiplier", factor: 1.5, modelIds: ["mistral7b", "llama70b"] },
  },
  {
    id: "mixture_of_experts",
    name: "Mixture of Experts",
    description: "+50% tokens/s: GPT-4, Claude Haiku",
    currency: "tokens",
    cost: 20_000,
    effect: { type: "modelMultiplier", factor: 1.5, modelIds: ["gpt4", "claude_haiku"] },
  },
  {
    id: "flash_attention",
    name: "Flash Attention",
    description: "−25% compute cost: GPT-4, Claude Haiku",
    currency: "tokens",
    cost: 35_000,
    effect: { type: "modelComputeMultiplier", factor: 0.75, modelIds: ["gpt4", "claude_haiku"] },
  },
  {
    id: "chain_of_thought",
    name: "Chain of Thought",
    description: "+60% tokens/s: GPT-4",
    currency: "tokens",
    cost: 60_000,
    effect: { type: "modelMultiplier", factor: 1.6, modelIds: ["gpt4"] },
  },
  {
    id: "rlhf",
    name: "RLHF",
    description: "+40% tokens/s: all models",
    currency: "tokens",
    cost: 300_000,
    effect: { type: "modelMultiplier", factor: 1.4 },
  },
  {
    id: "constitutional_ai",
    name: "Constitutional AI",
    description: "−30% compute cost: all models",
    currency: "tokens",
    cost: 6_000_000,
    effect: { type: "modelComputeMultiplier", factor: 0.7 },
  },
  {
    id: "hype_machine",
    name: "Hype Machine",
    description: "Hype milestones give ×2 Hype",
    currency: "tokens",
    cost: 1_000_000,
    effect: { type: "hypeMilestoneMultiplier", factor: 2 },
  },
  {
    id: "go_viral",
    name: "Go Viral",
    description: "Hype milestones give ×5 Hype",
    currency: "tokens",
    cost: 50_000_000,
    effect: { type: "hypeMilestoneMultiplier", factor: 5 },
  },
  // ── Funding-cost upgrades ───────────────────────────────────────────────────
  {
    id: "hire_interns",
    name: "Hire Interns",
    description: "+30% funding/s: all investors",
    currency: "funding",
    cost: 30,
    effect: { type: "investorMultiplier", factor: 1.3 },
  },
  {
    id: "poach_from_google",
    name: "Poach from Google",
    description: "+50% funding/s: all investors",
    currency: "funding",
    cost: 300,
    effect: { type: "investorMultiplier", factor: 1.5 },
  },
  {
    id: "open_source_everything",
    name: "Open Source Everything",
    description: "−20% compute cost: all models",
    currency: "funding",
    cost: 3_000,
    effect: { type: "modelComputeMultiplier", factor: 0.8 },
  },
  {
    id: "acquire_startup",
    name: "Acquire a Startup",
    description: "+60% funding/s: all investors",
    currency: "funding",
    cost: 25_000,
    effect: { type: "investorMultiplier", factor: 1.6 },
  },
  {
    id: "agi_safety_theater",
    name: "AGI Safety Theater",
    description: "+50% tokens/s: all models (permanent)",
    currency: "funding",
    cost: 300_000,
    effect: { type: "modelMultiplier", factor: 1.5 },
  },
];

export const UPGRADE_MAP: Record<UpgradeId, UpgradeDef> = Object.fromEntries(
  UPGRADES.map((u) => [u.id, u])
) as Record<UpgradeId, UpgradeDef>;

// ─── Milestones ───────────────────────────────────────────────────────────────

export const MILESTONES: MilestoneDef[] = [
  { id: "m1k", totalTokensRequired: 1_000, hypeGain: 0.5, message: "Someone on Twitter noticed you" },
  { id: "m10k", totalTokensRequired: 10_000, hypeGain: 1, message: "HackerNews front page" },
  { id: "m100k", totalTokensRequired: 100_000, hypeGain: 2, message: "TechCrunch article" },
  { id: "m1m", totalTokensRequired: 1_000_000, hypeGain: 3, message: "Trending on X" },
  { id: "m10m", totalTokensRequired: 10_000_000, hypeGain: 5, message: "Jensen Huang mentioned you" },
  { id: "m100m", totalTokensRequired: 100_000_000, hypeGain: 8, message: "You're the next OpenAI" },
  { id: "m1b", totalTokensRequired: 1_000_000_000, hypeGain: 13, message: "Congressional hearing about you" },
  { id: "m10b", totalTokensRequired: 10_000_000_000, hypeGain: 21, message: "You are the AI" },
];

export const MILESTONE_MAP: Record<MilestoneId, MilestoneDef> = Object.fromEntries(
  MILESTONES.map((m) => [m.id, m])
) as Record<MilestoneId, MilestoneDef>;

// ─── Titles ───────────────────────────────────────────────────────────────────

export const FOUNDER_TITLES: { minPrestiges: number; title: string }[] = [
  { minPrestiges: 20, title: "AI Messiah" },
  { minPrestiges: 10, title: "Thought Leader" },
  { minPrestiges: 5, title: "Visionary" },
  { minPrestiges: 3, title: "Serial Entrepreneur" },
  { minPrestiges: 1, title: "First-Time Founder" },
  { minPrestiges: 0, title: "Indie Hacker" },
];

export function getFounderTitle(prestigeCount: number): string {
  for (const { minPrestiges, title } of FOUNDER_TITLES) {
    if (prestigeCount >= minPrestiges) return title;
  }
  return "Indie Hacker";
}
