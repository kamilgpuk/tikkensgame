import type { HardwareDef, ModelDef, InvestorDef, UpgradeDef, MilestoneDef, HardwareId, ModelId, InvestorId, UpgradeId, MilestoneId } from "./types.js";
export declare const COST_SCALE = 1.15;
export declare const PRESTIGE_TOKEN_THRESHOLD = 1000000;
export declare const HARDWARE: HardwareDef[];
export declare const HARDWARE_MAP: Record<HardwareId, HardwareDef>;
export declare const MODELS: ModelDef[];
export declare const MODEL_MAP: Record<ModelId, ModelDef>;
export declare const INVESTORS: InvestorDef[];
export declare const INVESTOR_MAP: Record<InvestorId, InvestorDef>;
export declare const UPGRADES: UpgradeDef[];
export declare const UPGRADE_MAP: Record<UpgradeId, UpgradeDef>;
export declare const MILESTONES: MilestoneDef[];
export declare const MILESTONE_MAP: Record<MilestoneId, MilestoneDef>;
export declare const FOUNDER_TITLES: {
    minPrestiges: number;
    title: string;
}[];
export declare function getFounderTitle(prestigeCount: number): string;
