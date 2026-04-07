import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useGame } from "./useGame.js";

// Mock the api module
vi.mock("../lib/api.js", () => ({
  api: {
    createPlayer: vi.fn(),
    login: vi.fn(),
    click: vi.fn(),
    buy: vi.fn(),
    prestige: vi.fn(),
  },
}));

// Mock WebSocket
class MockWebSocket {
  static OPEN = 1;
  readyState = MockWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((evt: { data: string }) => void) | null = null;
  close = vi.fn();
  send = vi.fn();

  constructor(public url: string) {
    // Simulate async open
    setTimeout(() => this.onopen?.(), 0);
  }

  /** Helper: simulate receiving a server message */
  simulateMessage(msg: object) {
    this.onmessage?.({ data: JSON.stringify(msg) });
  }

  simulateClose() {
    this.readyState = 3;
    this.onclose?.();
  }
}

let mockWsInstances: MockWebSocket[] = [];

beforeEach(() => {
  mockWsInstances = [];
  vi.stubGlobal("WebSocket", class extends MockWebSocket {
    constructor(url: string) {
      super(url);
      mockWsInstances.push(this);
    }
  });
  // Stub localStorage
  vi.stubGlobal("localStorage", {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });
  // Stub window.location
  vi.stubGlobal("location", { protocol: "http:", host: "localhost:3000" });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("useGame hook", () => {
  // H1: initializes with null state when no playerId stored
  it("H1: initializes with null state when no playerId in localStorage", () => {
    const { result } = renderHook(() => useGame());
    expect(result.current.state).toBeNull();
  });

  // H2: WebSocket connects and populates state when playerId stored
  it("H2: populates state when WebSocket sends state message", async () => {
    (localStorage.getItem as ReturnType<typeof vi.fn>)
      .mockImplementation((key: string) =>
        key === "ai_hype_player_id" ? "p1" : key === "ai_hype_player_name" ? "Alice" : null
      );

    const { result } = renderHook(() => useGame());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50)); // let WS open
    });

    const ws = mockWsInstances[0];
    expect(ws).toBeDefined();

    const fakeState = {
      playerId: "p1", playerName: "Alice",
      tokens: 100, compute: 0, hype: 0, funding: 0,
      totalTokensEarned: 100, totalClicks: 10, prestigeCount: 0, reputation: 0,
      tokensPerSecond: 0, computePerSecond: 0, fundingPerSecond: 0, clickPower: 1,
      hardware: {}, models: {}, investors: {}, upgrades: [], milestonesHit: [],
      updatedAt: Date.now(),
    };

    act(() => {
      ws.simulateMessage({ type: "state", payload: fakeState });
    });

    expect(result.current.state?.tokens.toNumber()).toBe(100);
  });

  // H3: doClick triggers POST and updates state via WS
  it("H3: doClick calls api.click", async () => {
    const { api } = await import("../lib/api.js");
    (api.click as ReturnType<typeof vi.fn>).mockResolvedValue({ tokens: 5 });

    (localStorage.getItem as ReturnType<typeof vi.fn>)
      .mockImplementation((key: string) =>
        key === "ai_hype_player_id" ? "p1" : key === "ai_hype_player_name" ? "Alice" : null
      );

    const { result } = renderHook(() => useGame());
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    await act(async () => {
      result.current.doClick();
    });

    expect(api.click).toHaveBeenCalledWith("p1", 1);
  });

  // H4: disconnect triggers reconnect
  it("H4: WebSocket close triggers reconnect attempt", async () => {
    (localStorage.getItem as ReturnType<typeof vi.fn>)
      .mockImplementation((key: string) =>
        key === "ai_hype_player_id" ? "p1" : key === "ai_hype_player_name" ? "Alice" : null
      );

    vi.useFakeTimers();
    const { result } = renderHook(() => useGame());

    await act(async () => {
      vi.advanceTimersByTime(50);
    });

    const firstWs = mockWsInstances[0];
    act(() => { firstWs?.simulateClose(); });

    // Advance time past reconnect delay (2000ms)
    await act(async () => { vi.advanceTimersByTime(2100); });

    expect(mockWsInstances.length).toBeGreaterThanOrEqual(2);
    vi.useRealTimers();
  });
});
