import type { default as Decimal } from "break_eternity.js";
export type { Decimal };

// ─── ID types ────────────────────────────────────────────────────────────────

export type HardwareId =
  | "mac_mini"
  | "gaming_pc"
  | "a100"
  | "tpu_pod"
  | "gpu_cluster"
  | "data_center"
  | "hyperscaler";

export type ModelId =
  | "gpt2"
  | "llama7b"
  | "mistral7b"
  | "llama70b"
  | "claude_haiku"
  | "gpt4"
  | "agi";

export type InvestorId =
  | "moms_card"
  | "angel"
  | "seed"
  | "series_a"
  | "softbank"
  | "saudi_fund";

export type UpgradeId =
  | "better_prompts"
  | "prompt_engineering"
  | "chain_of_thought"
  | "quantization"
  | "flash_attention"
  | "mixture_of_experts"
  | "rlhf"
  | "constitutional_ai"
  | "hype_machine"
  | "go_viral"
  | "hire_interns"
  | "poach_from_google"
  | "open_source_everything"
  | "acquire_startup"
  | "agi_safety_theater"
  | "distributed_cache"
  | "sharded_storage"
  | "infinite_context"
  | "global_memory_net";

export type MilestoneId =
  | "m1k"
  | "m10k"
  | "m100k"
  | "m1m"
  | "m10m"
  | "m100m"
  | "m1b"
  | "m10b";

export type ProducerType = "hardware" | "model" | "investor";

// ─── Producer/Upgrade definitions ────────────────────────────────────────────

export interface HardwareDef {
  id: HardwareId;
  name: string;
  computePerSec: number;
  fundingRunningCost: number; // funding/s consumed to keep this unit running (0 for entry-level)
  costScale: number; // price scaling ratio per additional unit (e.g. 1.25)
  baseCost: number;
  unlockCondition: { type: "start" } | { type: "ownHardware"; id: HardwareId; qty: number };
}

export interface ModelDef {
  id: ModelId;
  name: string;
  // Base compute/s for the 1st instance. Each additional instance costs ×1.18 more (geometric scaling).
  computePerSec: number;
  tokensPerSec: number;
  costScale: number; // price scaling ratio per additional unit (1.30 for all models)
  baseCost: number;
  unlockCondition:
    | { type: "start" }
    | { type: "ownHardware"; id: HardwareId; qty: number }
    | { type: "ownHardwareAndPrestige"; id: HardwareId; qty: number; prestiges: number };
}

export interface InvestorDef {
  id: InvestorId;
  name: string;
  fundingPerSec: number;
  costScale: number; // price scaling ratio per additional unit (1.20 for all investors)
  baseCost: number;
  unlockCondition: { type: "hype"; min: number };
}

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  description: string;
  currency: "tokens" | "funding";
  cost: number;
  effect: UpgradeEffect;
}

export type UpgradeEffect =
  | { type: "clickMultiplier"; factor: number }
  | { type: "hardwareMultiplier"; factor: number }
  | { type: "modelMultiplier"; factor: number; modelIds?: ModelId[] }
  | { type: "modelComputeMultiplier"; factor: number; modelIds?: ModelId[] }
  | { type: "investorMultiplier"; factor: number }
  | { type: "allProducerMultiplier"; factor: number }
  | { type: "hypeMilestoneMultiplier"; factor: number }
  | { type: "hypeMultiplier"; factor: number }
  | { type: "tokenCapMultiplier"; factor: number };

export interface MilestoneDef {
  id: MilestoneId;
  totalTokensRequired: number;
  hypeGain: number;
  message: string;
}

// ─── Game State ───────────────────────────────────────────────────────────────

export interface GameState {
  playerId: string;
  playerName: string;

  // Current resources — Decimal to handle arbitrarily large values
  tokens: Decimal;
  compute: Decimal;
  hype: number;       // bounded ~1600 by finite milestones, safe as number
  funding: Decimal;

  // Lifetime stats
  totalTokensEarned: Decimal;
  totalClicks: number;    // integer count, safe as number
  prestigeCount: number;  // small integer, safe as number
  reputation: number;     // grows as log10, max ~50, safe as number

  // Computed rates (per second) — Decimal (products of many multipliers)
  tokensPerSecond: Decimal;
  computePerSecond: Decimal;
  fundingPerSecond: Decimal;
  clickPower: Decimal;

  // Owned counts — small integers, safe as number
  hardware: Record<HardwareId, number>;
  models: Record<ModelId, number>;
  investors: Record<InvestorId, number>;

  // Storage caps — plain numbers (not Decimal); recomputed each tick
  tokenCap: number;
  computeCap: number;

  // Marketing spend count — used to scale cost (10 × 3^n)
  marketingCount: number;

  // Purchased upgrades
  upgrades: UpgradeId[];

  // Milestones hit
  milestonesHit: MilestoneId[];

  updatedAt: number; // unix ms
}

// Wire/DB format — Decimal fields serialized as strings for JSON transport
export interface SerializedGameState {
  playerId: string;
  playerName: string;
  tokens: string;
  compute: string;
  hype: number;
  funding: string;
  totalTokensEarned: string;
  totalClicks: number;
  prestigeCount: number;
  reputation: number;
  tokensPerSecond: string;
  computePerSecond: string;
  fundingPerSecond: string;
  clickPower: string;
  tokenCap: number;
  computeCap: number;
  marketingCount: number;
  hardware: Record<HardwareId, number>;
  models: Record<ModelId, number>;
  investors: Record<InvestorId, number>;
  upgrades: UpgradeId[];
  milestonesHit: MilestoneId[];
  updatedAt: number;
}

// ─── API shapes ───────────────────────────────────────────────────────────────

export interface BuyRequest {
  producerType: ProducerType;
  id: HardwareId | ModelId | InvestorId | UpgradeId;
  quantity?: number;
}

export interface ActionOption {
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
  // Hardware-specific
  computePerSecGain?: number;
  fundingRunningCost?: number;
  isOnline?: boolean;
  offlineUnitsCount?: number;
  // Model-specific
  nextInstanceComputeCost?: number;
  totalComputeConsumed?: number;
}

export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  playerName: string;
  score: number;
  prestigeCount: number;
  title: string;
  lastActive: number;
}

// ─── WebSocket messages ───────────────────────────────────────────────────────

export type ServerMessage =
  | { type: "state"; payload: GameState }
  | { type: "milestone"; payload: { id: MilestoneId; message: string; hypeGain: number } }
  | { type: "leaderboard"; payload: LeaderboardEntry[] }
  | { type: "mcp_action"; payload: { action: string } };

export type ClientMessage =
  | { type: "init"; playerId: string }
