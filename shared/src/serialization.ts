import Decimal from "break_eternity.js";
import type { GameState, SerializedGameState } from "./types.js";

const D_FIELDS = [
  "tokens",
  "compute",
  "funding",
  "totalTokensEarned",
  "tokensPerSecond",
  "computePerSecond",
  "fundingPerSecond",
  "clickPower",
] as const;

export function serializeState(state: GameState): SerializedGameState {
  return {
    ...state,
    tokens: state.tokens.toString(),
    compute: state.compute.toString(),
    funding: state.funding.toString(),
    totalTokensEarned: state.totalTokensEarned.toString(),
    tokensPerSecond: state.tokensPerSecond.toString(),
    computePerSecond: state.computePerSecond.toString(),
    fundingPerSecond: state.fundingPerSecond.toString(),
    clickPower: state.clickPower.toString(),
  };
}

export function deserializeState(raw: SerializedGameState | Record<string, unknown>): GameState {
  const r = raw as Record<string, unknown>;

  // Helper: parse a field as Decimal. Handles number, string, or missing (→ 0).
  function d(key: string): Decimal {
    const v = r[key];
    if (v === undefined || v === null) return new Decimal(0);
    if (v instanceof Decimal) return v;
    const n = new Decimal(v as string | number);
    return n.isFinite() ? n : new Decimal(0);
  }

  return {
    playerId: r.playerId as string,
    playerName: r.playerName as string,
    tokens: d("tokens"),
    compute: d("compute"),
    hype: typeof r.hype === "number" ? r.hype : 0,
    funding: d("funding"),
    totalTokensEarned: d("totalTokensEarned"),
    totalClicks: typeof r.totalClicks === "number" ? r.totalClicks : 0,
    prestigeCount: typeof r.prestigeCount === "number" ? r.prestigeCount : 0,
    reputation: typeof r.reputation === "number" ? r.reputation : 0,
    tokensPerSecond: d("tokensPerSecond"),
    computePerSecond: d("computePerSecond"),
    fundingPerSecond: d("fundingPerSecond"),
    clickPower: d("clickPower"),
    hardware: (r.hardware as GameState["hardware"]) ?? {
      mac_mini: 0, gaming_pc: 0, a100: 0, tpu_pod: 0,
      gpu_cluster: 0, data_center: 0, hyperscaler: 0,
    },
    models: (r.models as GameState["models"]) ?? {
      gpt2: 0, llama7b: 0, mistral7b: 0, llama70b: 0,
      claude_haiku: 0, gpt4: 0, agi: 0,
    },
    investors: (r.investors as GameState["investors"]) ?? {
      moms_card: 0, angel: 0, seed: 0,
      series_a: 0, softbank: 0, saudi_fund: 0,
    },
    tokenCap: typeof r.tokenCap === "number" ? r.tokenCap : 1_000,
    computeCap: typeof r.computeCap === "number" ? r.computeCap : 50,
    upgrades: (r.upgrades as GameState["upgrades"]) ?? [],
    milestonesHit: (r.milestonesHit as GameState["milestonesHit"]) ?? [],
    updatedAt: typeof r.updatedAt === "number" ? r.updatedAt : Date.now(),
  };
}

export { D_FIELDS };
