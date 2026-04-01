export type HardwareId = "mac_mini" | "gaming_pc" | "a100" | "tpu_pod" | "gpu_cluster" | "data_center" | "hyperscaler";
export type ModelId = "gpt2" | "llama7b" | "mistral7b" | "llama70b" | "claude_haiku" | "gpt4" | "agi";
export type InvestorId = "moms_card" | "angel" | "seed" | "series_a" | "softbank" | "saudi_fund";
export type UpgradeId = "better_prompts" | "prompt_engineering" | "chain_of_thought" | "quantization" | "flash_attention" | "mixture_of_experts" | "rlhf" | "constitutional_ai" | "hype_machine" | "go_viral" | "hire_interns" | "poach_from_google" | "open_source_everything" | "acquire_startup" | "agi_safety_theater";
export type MilestoneId = "m1k" | "m10k" | "m100k" | "m1m" | "m10m" | "m100m" | "m1b" | "m10b";
export type ProducerType = "hardware" | "model" | "investor";
export interface HardwareDef {
    id: HardwareId;
    name: string;
    computePerSec: number;
    baseCost: number;
    unlockCondition: {
        type: "start";
    } | {
        type: "ownHardware";
        id: HardwareId;
        qty: number;
    };
}
export interface ModelDef {
    id: ModelId;
    name: string;
    computePerSec: number;
    tokensPerSec: number;
    baseCost: number;
    unlockCondition: {
        type: "start";
    } | {
        type: "ownHardware";
        id: HardwareId;
        qty: number;
    } | {
        type: "ownHardwareAndPrestige";
        id: HardwareId;
        qty: number;
        prestiges: number;
    };
}
export interface InvestorDef {
    id: InvestorId;
    name: string;
    fundingPerSec: number;
    baseCost: number;
    unlockCondition: {
        type: "hype";
        min: number;
    };
}
export interface UpgradeDef {
    id: UpgradeId;
    name: string;
    description: string;
    currency: "tokens" | "funding";
    cost: number;
    effect: UpgradeEffect;
}
export type UpgradeEffect = {
    type: "clickMultiplier";
    factor: number;
} | {
    type: "hardwareMultiplier";
    factor: number;
} | {
    type: "modelMultiplier";
    factor: number;
} | {
    type: "allProducerMultiplier";
    factor: number;
} | {
    type: "hypeMilestoneMultiplier";
    factor: number;
} | {
    type: "hypeMultiplier";
    factor: number;
};
export interface MilestoneDef {
    id: MilestoneId;
    totalTokensRequired: number;
    hypeGain: number;
    message: string;
}
export interface GameState {
    playerId: string;
    playerName: string;
    tokens: number;
    compute: number;
    hype: number;
    funding: number;
    totalTokensEarned: number;
    totalClicks: number;
    prestigeCount: number;
    reputation: number;
    tokensPerSecond: number;
    computePerSecond: number;
    fundingPerSecond: number;
    clickPower: number;
    hardware: Record<HardwareId, number>;
    models: Record<ModelId, number>;
    investors: Record<InvestorId, number>;
    upgrades: UpgradeId[];
    milestonesHit: MilestoneId[];
    updatedAt: number;
}
export interface BuyRequest {
    producerType: ProducerType;
    id: HardwareId | ModelId | InvestorId | UpgradeId;
    quantity?: number;
}
export interface ActionOption {
    type: "hardware" | "model" | "investor" | "upgrade";
    id: string;
    name: string;
    cost: number;
    currency: "tokens" | "funding";
    affordable: boolean;
    tokensPerSecGain: number;
    paybackSeconds: number | null;
    unlocksNew: boolean;
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
export type ServerMessage = {
    type: "state";
    payload: GameState;
} | {
    type: "milestone";
    payload: {
        id: MilestoneId;
        message: string;
        hypeGain: number;
    };
} | {
    type: "leaderboard";
    payload: LeaderboardEntry[];
};
export type ClientMessage = {
    type: "init";
    playerId: string;
};
