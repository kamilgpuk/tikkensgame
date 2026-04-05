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

export const COST_SCALE = 1.15; // each additional unit costs base × 1.15^owned

/** Token goal for prestige n (run 0 → 1M, run 1 → 10M, run 2 → 100M…) */
export function prestigeTokenThreshold(prestigeCount: number): number {
  return 1_000_000 * Math.pow(10, prestigeCount);
}

/** Funding required to prestige on run n (0 → 10k, 1 → 50k, 2 → 250k…) */
export function prestigeFundingThreshold(prestigeCount: number): number {
  return 10_000 * Math.pow(5, prestigeCount);
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
    computePerSec: 1,
    baseCost: 10,
    unlockCondition: { type: "start" },
  },
  {
    id: "gaming_pc",
    name: "Gaming PC",
    computePerSec: 8,
    baseCost: 150,
    unlockCondition: { type: "ownHardware", id: "mac_mini", qty: 3 },
  },
  {
    id: "a100",
    name: "A100 GPU",
    computePerSec: 60,
    baseCost: 2_000,
    unlockCondition: { type: "ownHardware", id: "gaming_pc", qty: 3 },
  },
  {
    id: "tpu_pod",
    name: "TPU Pod",
    computePerSec: 500,
    baseCost: 25_000,
    unlockCondition: { type: "ownHardware", id: "a100", qty: 3 },
  },
  {
    id: "gpu_cluster",
    name: "GPU Cluster",
    computePerSec: 4_000,
    baseCost: 300_000,
    unlockCondition: { type: "ownHardware", id: "tpu_pod", qty: 3 },
  },
  {
    id: "data_center",
    name: "Data Center",
    computePerSec: 35_000,
    baseCost: 4_000_000,
    unlockCondition: { type: "ownHardware", id: "gpu_cluster", qty: 3 },
  },
  {
    id: "hyperscaler",
    name: "Hyperscaler",
    computePerSec: 400_000,
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
    computePerSec: 1,
    tokensPerSec: 3,
    baseCost: 50,
    unlockCondition: { type: "start" },
  },
  {
    id: "llama7b",
    name: "Llama 7B",
    computePerSec: 8,
    tokensPerSec: 30,
    baseCost: 800,
    unlockCondition: { type: "ownHardware", id: "mac_mini", qty: 1 },
  },
  {
    id: "mistral7b",
    name: "Mistral 7B",
    computePerSec: 40,
    tokensPerSec: 180,
    baseCost: 10_000,
    unlockCondition: { type: "ownHardware", id: "gaming_pc", qty: 1 },
  },
  {
    id: "llama70b",
    name: "Llama 70B",
    computePerSec: 200,
    tokensPerSec: 1_000,
    baseCost: 120_000,
    unlockCondition: { type: "ownHardware", id: "a100", qty: 1 },
  },
  {
    id: "claude_haiku",
    name: "Claude Haiku",
    computePerSec: 800,
    tokensPerSec: 4_500,
    baseCost: 1_500_000,
    unlockCondition: { type: "ownHardware", id: "tpu_pod", qty: 1 },
  },
  {
    id: "gpt4",
    name: "GPT-4",
    computePerSec: 3_500,
    tokensPerSec: 22_000,
    baseCost: 20_000_000,
    unlockCondition: { type: "ownHardware", id: "gpu_cluster", qty: 1 },
  },
  {
    id: "agi",
    name: "AGI (????)",
    computePerSec: 30_000,
    tokensPerSec: 250_000,
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
    baseCost: 500,
    unlockCondition: { type: "hype", min: 1 },
  },
  {
    id: "angel",
    name: "Angel Investor",
    fundingPerSec: 0.6,
    baseCost: 8_000,
    unlockCondition: { type: "hype", min: 3 },
  },
  {
    id: "seed",
    name: "Seed Round",
    fundingPerSec: 4,
    baseCost: 100_000,
    unlockCondition: { type: "hype", min: 5 },
  },
  {
    id: "series_a",
    name: "Series A VC",
    fundingPerSec: 25,
    baseCost: 1_500_000,
    unlockCondition: { type: "hype", min: 10 },
  },
  {
    id: "softbank",
    name: "SoftBank",
    fundingPerSec: 200,
    baseCost: 30_000_000,
    unlockCondition: { type: "hype", min: 20 },
  },
  {
    id: "saudi_fund",
    name: "Saudi Sovereign Fund",
    fundingPerSec: 2_000,
    baseCost: 800_000_000,
    unlockCondition: { type: "hype", min: 50 },
  },
];

export const INVESTOR_MAP: Record<InvestorId, InvestorDef> = Object.fromEntries(
  INVESTORS.map((i) => [i.id, i])
) as Record<InvestorId, InvestorDef>;

// ─── Upgrades ─────────────────────────────────────────────────────────────────

export const UPGRADES: UpgradeDef[] = [
  {
    id: "better_prompts",
    name: "Better Prompts",
    description: "Click gives ×2 tokens",
    currency: "tokens",
    cost: 100,
    effect: { type: "clickMultiplier", factor: 2 },
  },
  {
    id: "prompt_engineering",
    name: "Prompt Engineering",
    description: "Click gives ×5 tokens",
    currency: "tokens",
    cost: 5_000,
    effect: { type: "clickMultiplier", factor: 5 },
  },
  {
    id: "chain_of_thought",
    name: "Chain of Thought",
    description: "Click gives ×10 tokens",
    currency: "tokens",
    cost: 100_000,
    effect: { type: "clickMultiplier", factor: 10 },
  },
  {
    id: "quantization",
    name: "Quantization",
    description: "All hardware ×2 Compute/s",
    currency: "tokens",
    cost: 2_000,
    effect: { type: "hardwareMultiplier", factor: 2 },
  },
  {
    id: "flash_attention",
    name: "Flash Attention",
    description: "All hardware ×3 Compute/s",
    currency: "tokens",
    cost: 50_000,
    effect: { type: "hardwareMultiplier", factor: 3 },
  },
  {
    id: "mixture_of_experts",
    name: "Mixture of Experts",
    description: "All models ×2 Tokens/s",
    currency: "tokens",
    cost: 30_000,
    effect: { type: "modelMultiplier", factor: 2 },
  },
  {
    id: "rlhf",
    name: "RLHF",
    description: "All models ×3 Tokens/s",
    currency: "tokens",
    cost: 500_000,
    effect: { type: "modelMultiplier", factor: 3 },
  },
  {
    id: "constitutional_ai",
    name: "Constitutional AI",
    description: "All models ×5 Tokens/s",
    currency: "tokens",
    cost: 10_000_000,
    effect: { type: "modelMultiplier", factor: 5 },
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
  {
    id: "hire_interns",
    name: "Hire Interns",
    description: "All models ×1.5 Tokens/s",
    currency: "funding",
    cost: 50,
    effect: { type: "modelMultiplier", factor: 1.5 },
  },
  {
    id: "poach_from_google",
    name: "Poach from Google",
    description: "All models ×2 Tokens/s",
    currency: "funding",
    cost: 500,
    effect: { type: "modelMultiplier", factor: 2 },
  },
  {
    id: "open_source_everything",
    name: "Open Source Everything",
    description: "All producers ×2 output",
    currency: "funding",
    cost: 5_000,
    effect: { type: "allProducerMultiplier", factor: 2 },
  },
  {
    id: "acquire_startup",
    name: "Acquire a Startup",
    description: "All producers ×3 output",
    currency: "funding",
    cost: 50_000,
    effect: { type: "allProducerMultiplier", factor: 3 },
  },
  {
    id: "agi_safety_theater",
    name: "AGI Safety Theater",
    description: "Hype ×3 (permanent)",
    currency: "funding",
    cost: 500_000,
    effect: { type: "hypeMultiplier", factor: 3 },
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
