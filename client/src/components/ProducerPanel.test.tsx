import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProducerPanel } from "./ProducerPanel.js";
import type { GameState } from "@ai-hype/shared";

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    playerId: "p1", playerName: "Alice",
    tokens: 0, compute: 0, hype: 0, funding: 0,
    totalTokensEarned: 0, totalClicks: 0, prestigeCount: 0, reputation: 0,
    tokensPerSecond: 0, computePerSecond: 0, fundingPerSecond: 0, clickPower: 1,
    hardware: { mac_mini: 0, gaming_pc: 0, a100: 0, tpu_pod: 0, gpu_cluster: 0, data_center: 0, hyperscaler: 0 },
    models: { gpt2: 0, llama7b: 0, mistral7b: 0, llama70b: 0, claude_haiku: 0, gpt4: 0, agi: 0 },
    investors: { moms_card: 0, angel: 0, seed: 0, series_a: 0, softbank: 0, saudi_fund: 0 },
    upgrades: [], milestonesHit: [], updatedAt: Date.now(),
    ...overrides,
  };
}

describe("ProducerPanel component", () => {
  // CL6: shows locked vs unlocked — locked hardware has a different visual state
  it("CL6: locked gaming_pc row has 'locked' CSS class", () => {
    const state = makeState({ tokens: 0 }); // 0 mac_minis → gaming_pc locked
    const { container } = render(<ProducerPanel state={state} onBuy={vi.fn()} />);
    // Find all producer rows with 'locked' class
    const lockedRows = container.querySelectorAll(".producer-row.locked");
    expect(lockedRows.length).toBeGreaterThan(0);
  });

  // CL7: buy button disabled when unaffordable
  it("CL7: Mac Mini buy buttons are disabled when tokens=0 (cost is 10)", () => {
    const state = makeState({ tokens: 0 });
    const { container } = render(<ProducerPanel state={state} onBuy={vi.fn()} />);
    // All buy buttons should be disabled since no tokens
    const buyButtons = container.querySelectorAll("button.buy-btn");
    expect(buyButtons.length).toBeGreaterThan(0);
    // At least the mac_mini buy button should be disabled
    const macMiniRow = container.querySelector(".producer-row:not(.locked)");
    const macMiniBuyBtn = macMiniRow?.querySelector("button.buy-btn");
    expect(macMiniBuyBtn).toBeDisabled();
  });

  it("Mac Mini buy button enabled when tokens >= cost (10)", () => {
    const state = makeState({ tokens: 100 });
    const { container } = render(<ProducerPanel state={state} onBuy={vi.fn()} />);
    const macMiniRow = container.querySelector(".producer-row:not(.locked)");
    const macMiniBuyBtn = macMiniRow?.querySelector("button.buy-btn");
    expect(macMiniBuyBtn).not.toBeDisabled();
  });

  it("renders producer name elements", () => {
    const state = makeState({ tokens: 0 });
    const { container } = render(<ProducerPanel state={state} onBuy={vi.fn()} />);
    const names = container.querySelectorAll(".producer-name");
    expect(names.length).toBeGreaterThan(0);
    const nameTexts = Array.from(names).map(el => el.textContent?.toLowerCase() ?? "");
    expect(nameTexts.some(t => t.includes("mac mini") || t.includes("mac_mini") || t.includes("gpt"))).toBe(true);
  });
});
