import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ClickButton } from "./ClickButton.js";
import type { GameState } from "@ai-hype/shared";
import Decimal from "break_eternity.js";

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    playerId: "p1",
    playerName: "Alice",
    tokens: new Decimal(0),
    compute: new Decimal(0),
    hype: 0,
    funding: new Decimal(0),
    totalTokensEarned: new Decimal(0),
    totalClicks: 0,
    prestigeCount: 0,
    reputation: 0,
    tokensPerSecond: new Decimal(0),
    computePerSecond: new Decimal(0),
    fundingPerSecond: new Decimal(0),
    clickPower: new Decimal(1),
    hardware: { mac_mini: 0, gaming_pc: 0, a100: 0, tpu_pod: 0, gpu_cluster: 0, data_center: 0, hyperscaler: 0 },
    models: { gpt2: 0, llama7b: 0, mistral7b: 0, llama70b: 0, claude_haiku: 0, gpt4: 0, agi: 0 },
    investors: { moms_card: 0, angel: 0, seed: 0, series_a: 0, softbank: 0, saudi_fund: 0 },
    tokenCap: 1_000, marketingCount: 0,
    computeCap: 50,
    upgrades: [],
    milestonesHit: [],
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe("ClickButton component", () => {
  // CL4: renders click power
  it("CL4: renders current clickPower", () => {
    render(<ClickButton state={makeState({ clickPower: new Decimal(5) })} onClick={vi.fn()} />);
    expect(screen.getByText(/5\.0 \/ click/i)).toBeInTheDocument();
  });

  // CL5: click fires onClick
  it("CL5: clicking the button calls onClick", () => {
    const onClick = vi.fn();
    render(<ClickButton state={makeState()} onClick={onClick} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("shows +N pop animation text after click", async () => {
    render(<ClickButton state={makeState({ clickPower: new Decimal(1) })} onClick={vi.fn()} />);
    fireEvent.click(screen.getByRole("button"));
    // Pop span appears
    expect(screen.getByText(/^\+/)).toBeInTheDocument();
  });

  it("shows total clicks count", () => {
    render(<ClickButton state={makeState({ totalClicks: 42 })} onClick={vi.fn()} />);
    expect(screen.getByText(/42 total clicks/i)).toBeInTheDocument();
  });
});
