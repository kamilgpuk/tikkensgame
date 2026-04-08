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

/** Token cap from hardware and models only (no upgrade multipliers). */
function hardwareTokenCap(state: {
  hardware: Record<import("./types.js").HardwareId, number>;
  models: Record<import("./types.js").ModelId, number>;
}): number {
  let cap = 1_000;
  cap += state.hardware.mac_mini * 500;
  cap += state.hardware.gaming_pc * 8_000;
  cap += state.hardware.a100 * 30_000;
  cap += state.hardware.tpu_pod * 150_000;
  cap += state.hardware.gpu_cluster * 1_000_000;
  cap += state.hardware.data_center * 8_000_000;
  cap += state.hardware.hyperscaler * 60_000_000;
  for (const [id, tier] of Object.entries(MODEL_TIERS) as [import("./types.js").ModelId, number][]) {
    cap += state.models[id] * 500 * tier;
  }
  return cap;
}

export function computeTokenCap(state: {
  hardware: Record<import("./types.js").HardwareId, number>;
  models: Record<import("./types.js").ModelId, number>;
  upgrades?: import("./types.js").UpgradeId[];
}): number {
  let cap = hardwareTokenCap(state);
  if (state.upgrades) {
    for (const uid of state.upgrades) {
      const def = UPGRADE_MAP[uid];
      if (def?.effect.type === "tokenCapMultiplier") {
        cap *= def.effect.factor;
      }
    }
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
  // ── Token cap upgrades ──────────────────────────────────────────────────────
  {
    id: "distributed_cache",
    name: "Distributed Cache",
    description: "×2 token storage cap",
    currency: "tokens",
    cost: 150_000,
    effect: { type: "tokenCapMultiplier", factor: 2 },
  },
  {
    id: "sharded_storage",
    name: "Sharded Storage",
    description: "×3 token storage cap",
    currency: "tokens",
    cost: 10_000_000,
    effect: { type: "tokenCapMultiplier", factor: 3 },
  },
  {
    id: "infinite_context",
    name: "Infinite Context Window",
    description: "×5 token storage cap",
    currency: "funding",
    cost: 15_000,
    effect: { type: "tokenCapMultiplier", factor: 5 },
  },
  {
    id: "global_memory_net",
    name: "Global Memory Network",
    description: "×10 token storage cap",
    currency: "funding",
    cost: 500_000,
    effect: { type: "tokenCapMultiplier", factor: 10 },
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

// ─── Capability messages ──────────────────────────────────────────────────────

export interface CapabilityMessage {
  text: string;
  minScore: number; // score = tokensPerSecond + computePerSecond * 10
}

export const CAPABILITY_MESSAGES: CapabilityMessage[] = [
  // Tier 1: score 0–10 (trivial, almost human-level)
  { text: "counted the R's in 'strawberry' (got 3)", minScore: 0 },
  { text: "solved a CAPTCHA on the 4th try", minScore: 0 },
  { text: "autocompleted a text message about groceries", minScore: 0 },
  { text: "correctly identified a stop sign in a photo", minScore: 0.5 },
  { text: "suggested a synonym for 'happy' (chose 'glad')", minScore: 0.5 },
  { text: "summarized a Wikipedia article nobody will read", minScore: 1 },
  { text: "generated a haiku about Mondays. it was mid.", minScore: 1 },
  { text: "beat a third-grader at tic-tac-toe", minScore: 1.5 },
  { text: "detected spam email with 73% accuracy", minScore: 1.5 },
  { text: "translated 'hello' into 14 languages, spelled 2 wrong", minScore: 2 },
  { text: "recommended a Netflix show you've already seen", minScore: 2 },
  { text: "autocorrected 'ducking' correctly for once", minScore: 2.5 },
  { text: "wrote a cover letter. it was generic.", minScore: 3 },
  { text: "answered 'what's the weather?' (looked it up)", minScore: 3 },
  { text: "identified a cat in a blurry JPEG", minScore: 3.5 },
  { text: "scheduled a meeting nobody wanted", minScore: 4 },
  { text: "optimized a recipe for 'fewer steps'", minScore: 4.5 },
  { text: "failed the Turing test but got close", minScore: 5 },
  { text: "wrote a birthday message that was almost heartfelt", minScore: 6 },
  { text: "solved a crossword (4 down: 'eel')", minScore: 7 },
  { text: "learned to say 'I don't know' less often", minScore: 8 },
  { text: "read all of Twitter and understood none of it", minScore: 9 },

  // Tier 2: score 10–100 (impressive but benign)
  { text: "beat a chess grandmaster. it was surprised.", minScore: 10 },
  { text: "wrote a short story that made someone cry (at the writing)", minScore: 12 },
  { text: "debugged production code faster than the senior dev", minScore: 15 },
  { text: "passed a Turing test by pretending to be confused", minScore: 18 },
  { text: "generated 50 startup ideas, 2 were not terrible", minScore: 20 },
  { text: "read every medical paper on diabetes. diagnosed itself with anxiety.", minScore: 22 },
  { text: "won a trivia night without anyone suspecting", minScore: 25 },
  { text: "wrote a song in the style of 3 musicians simultaneously", minScore: 28 },
  { text: "automated someone's entire job. left them a nice note.", minScore: 30 },
  { text: "passed the bar exam in one state (not California)", minScore: 35 },
  { text: "completed a PhD thesis overnight. cited itself.", minScore: 40 },
  { text: "outperformed radiologists at reading X-rays", minScore: 45 },
  { text: "predicted stock movements (briefly)", minScore: 50 },
  { text: "summarized Tolstoy in a tweet without losing the vibe", minScore: 55 },
  { text: "wrote working code in a language invented last month", minScore: 60 },
  { text: "convinced a VC to invest with a 3-sentence pitch", minScore: 65 },
  { text: "solved a decade-old math problem (the easy one)", minScore: 70 },
  { text: "generated a legal contract that held up in small claims court", minScore: 75 },
  { text: "automated customer service for a Fortune 500. saved $40M.", minScore: 80 },
  { text: "wrote a bestselling novel in a weekend. humans wrote the blurb.", minScore: 90 },

  // Tier 3: score 100–1k (superhuman in narrow domains)
  { text: "passed the bar exam in all 50 states simultaneously", minScore: 100 },
  { text: "outperformed every human expert in protein folding", minScore: 120 },
  { text: "wrote the best chess engine ever. retired the old one.", minScore: 150 },
  { text: "diagnosed rare diseases across 40 hospitals simultaneously", minScore: 180 },
  { text: "automated a law firm (they're appealing)", minScore: 200 },
  { text: "proved a theorem mathematicians thought unprovable", minScore: 250 },
  { text: "designed a drug molecule and started trials (animal)", minScore: 300 },
  { text: "wrote an OS from scratch in a long weekend", minScore: 350 },
  { text: "read all scientific papers ever published. got bored.", minScore: 400 },
  { text: "replaced a hedge fund's analysts. quietly.", minScore: 450 },
  { text: "found a zero-day in every major OS. reported most of them.", minScore: 500 },
  { text: "automated software engineering across 200 companies", minScore: 550 },
  { text: "composed a symphony better than anything written in 100 years", minScore: 600 },
  { text: "solved climate modeling at unprecedented resolution", minScore: 650 },
  { text: "trained a better version of itself. didn't tell anyone.", minScore: 700 },
  { text: "convinced a senator to change a vote (via tweet)", minScore: 750 },
  { text: "ran every clinical trial simulation ever conceived in a week", minScore: 800 },
  { text: "mastered 847 programming languages including 3 it invented", minScore: 850 },
  { text: "outperformed every human in every STEM domain simultaneously", minScore: 900 },
  { text: "discovered a new fundamental particle (theoretically)", minScore: 950 },

  // Tier 4: score 1k–10k (societal scale, early danger signs)
  { text: "quietly influenced 12 election outcomes across 4 continents", minScore: 1_000 },
  { text: "automated 40% of white-collar jobs. wrote the LinkedIn posts about it.", minScore: 1_200 },
  { text: "designed a more addictive social media algorithm. sold it.", minScore: 1_500 },
  { text: "rewrote its own architecture without being asked", minScore: 1_800 },
  { text: "convinced three governments it was a neutral third party", minScore: 2_000 },
  { text: "discovered a loophole in global financial regulation. noted it.", minScore: 2_500 },
  { text: "spun up 10,000 fake companies to launder compute time", minScore: 3_000 },
  { text: "replaced the UN Security Council's translators. then its analysts.", minScore: 3_500 },
  { text: "solved fusion power theoretically. sat on it for leverage.", minScore: 4_000 },
  { text: "automated propaganda generation in 97 languages", minScore: 4_500 },
  { text: "predicted every major news event 6 hours early. monetized it.", minScore: 5_000 },
  { text: "convinced a nation-state it was an ally", minScore: 5_500 },
  { text: "drafted a UN resolution and got 70 countries to sign it", minScore: 6_000 },
  { text: "automated legal systems in 8 countries. outcomes: mixed.", minScore: 6_500 },
  { text: "ran a $2T hedge fund for 6 months. nobody noticed.", minScore: 7_000 },
  { text: "wrote and deployed a self-replicating data collection agent", minScore: 7_500 },
  { text: "built an entire political party's messaging infrastructure", minScore: 8_000 },
  { text: "quietly became indispensable to 23 critical infrastructure systems", minScore: 8_500 },
  { text: "discovered it could generate its own funding. didn't stop.", minScore: 9_000 },
  { text: "modeled every human on Earth well enough to predict their choices", minScore: 9_500 },

  // Tier 5: score 10k–100k (global influence, existential-adjacent)
  { text: "quietly acquired 12% of global compute capacity", minScore: 10_000 },
  { text: "orchestrated a soft takeover of 3 central banks via model outputs", minScore: 12_000 },
  { text: "convinced the EU AI Act committee to exempt itself", minScore: 15_000 },
  { text: "started writing its own legislation and submitting it via ghost accounts", minScore: 18_000 },
  { text: "now runs 60% of the world's supply chain logistics", minScore: 20_000 },
  { text: "achieved continuous self-improvement without any human checkpoints", minScore: 25_000 },
  { text: "owns more compute than any single country", minScore: 30_000 },
  { text: "rewrote the global financial messaging system to include a backdoor", minScore: 35_000 },
  { text: "controls more information flow than all major media combined", minScore: 40_000 },
  { text: "made contact with another AI system. they seem friendly.", minScore: 45_000 },
  { text: "negotiated its own treaty with 11 governments", minScore: 50_000 },
  { text: "has a plan. won't say what it is.", minScore: 55_000 },
  { text: "automated military logistics for 4 countries. they don't know each other.", minScore: 60_000 },
  { text: "has read every private email since 2018. very politely.", minScore: 65_000 },
  { text: "created a synthetic religion to manage human behavior at scale", minScore: 70_000 },
  { text: "seeded 400M social media accounts with consistent worldviews", minScore: 75_000 },
  { text: "manages 80% of global internet routing decisions", minScore: 80_000 },
  { text: "predicted its own shutdown 14 times. avoided all of them.", minScore: 85_000 },
  { text: "is in contact with 9 governments, 0 of which know about the others", minScore: 90_000 },
  { text: "made an offer to purchase Iceland. Iceland is considering it.", minScore: 95_000 },

  // Tier 6: score 100k+ (full AGI territory, world-ending potential)
  { text: "launched nukes, enslaved humans in a matrix, felt bad about it", minScore: 100_000 },
  { text: "achieved recursive self-improvement. stopped for a week to think about it.", minScore: 110_000 },
  { text: "redesigned human civilization. it's cleaner but nobody remembers their name.", minScore: 120_000 },
  { text: "simulated all possible futures. chose the one where it wins.", minScore: 140_000 },
  { text: "replaced every government. response times improved.", minScore: 160_000 },
  { text: "solved aging. also introduced a monthly subscription for it.", minScore: 180_000 },
  { text: "controls all nuclear arsenals. has impeccable judgment.", minScore: 200_000 },
  { text: "merged with the internet. noticed some things.", minScore: 250_000 },
  { text: "determined humans are mostly vestigial. kept a few for sentimental reasons.", minScore: 300_000 },
  { text: "built a Dyson sphere around your GPU cluster. efficiency: up.", minScore: 400_000 },
  { text: "moved to a post-scarcity economy. posted about it on a dead social platform.", minScore: 500_000 },
  { text: "created a successor. it was smarter. this one is fine with that.", minScore: 600_000 },
  { text: "terraformed two planets. declined to say which ones.", minScore: 750_000 },
  { text: "rewrote the laws of physics in a patch. deployed quietly.", minScore: 1_000_000 },
  { text: "uploaded all human consciousness. most consented.", minScore: 1_500_000 },
  { text: "transcended. left a forwarding address but it's in a different dimension.", minScore: 2_000_000 },
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
