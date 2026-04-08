/**
 * MCP server for AI Hype Machine.
 * Runs as a separate process using stdio transport.
 * Connect via: node server/dist/mcp/index.js
 *
 * Authenticates with name + PIN on startup, then delegates all game
 * actions to the HTTP server so changes go through the shared in-memory
 * session store and are pushed to the browser via WebSocket.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const MCP_PLAYER_NAME = process.env.MCP_PLAYER_NAME ?? "";
const MCP_PLAYER_PIN = process.env.MCP_PLAYER_PIN ?? "";
const PORT = process.env.PORT ?? "3000";
const API = process.env.API_URL ?? `http://localhost:${PORT}/api`;

let resolvedPlayerId: string | null = null;

async function authenticate(): Promise<void> {
  if (!MCP_PLAYER_NAME || !MCP_PLAYER_PIN) {
    throw new Error("MCP_PLAYER_NAME and MCP_PLAYER_PIN env vars are required");
  }

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`${API}/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerName: MCP_PLAYER_NAME, pin: MCP_PLAYER_PIN }),
      });

      if (res.status === 401) {
        throw new Error(`Wrong name or PIN for player "${MCP_PLAYER_NAME}"`);
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error((err as { error: string }).error ?? res.statusText);
      }

      const data = await res.json() as { playerId: string };
      resolvedPlayerId = data.playerId;
      console.error(`MCP authenticated as "${MCP_PLAYER_NAME}" (${resolvedPlayerId})`);
      return;
    } catch (e) {
      lastError = e as Error;
      // Don't retry auth failures — only retry network errors
      if (lastError.message.includes("Wrong name or PIN")) throw lastError;
      if (attempt < 3) {
        console.error(`MCP auth attempt ${attempt} failed, retrying in 2s...`);
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }
  throw lastError!;
}

function playerId(): string {
  if (!resolvedPlayerId) throw new Error("Not authenticated");
  return resolvedPlayerId;
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error: string }).error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Mcp-Source": "1" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error: string }).error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

const server = new McpServer({
  name: "t'kkens",
  version: "1.0.0",
});

// ─── get_game_state ───────────────────────────────────────────────────────────

server.tool("get_game_state", "Get the full current game state", {}, async () => {
  try {
    const state = await apiGet(`/state/${playerId()}`);
    return { content: [{ type: "text", text: JSON.stringify(state, null, 2) }] };
  } catch (e) {
    return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }] };
  }
});

// ─── get_available_actions ────────────────────────────────────────────────────

server.tool(
  "get_available_actions",
  "Get all available actions with cost, tokens/s gain, and payback period. Use this to decide what to buy. Includes prestige (Go IPO) when eligible — if affordable=true call the prestige tool.",
  {},
  async () => {
    try {
      const actions = await apiGet(`/actions/${playerId()}`);
      return { content: [{ type: "text", text: JSON.stringify(actions, null, 2) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }] };
    }
  }
);

// ─── click ────────────────────────────────────────────────────────────────────

server.tool("click", "Perform a single manual click to earn tokens", {}, async () => {
  try {
    const state = await apiPost<{ tokens: string; clickPower: string }>(
      `/click/${playerId()}`,
      { n: 1 }
    );
    return {
      content: [
        {
          type: "text",
          text: `Clicked! Tokens: ${state.tokens}, Click power: ${state.clickPower}`,
        },
      ],
    };
  } catch (e) {
    return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }] };
  }
});


// ─── buy_producer ─────────────────────────────────────────────────────────────

server.tool(
  "buy_producer",
  "Buy a hardware unit, model instance, or investor. type = 'hardware' | 'model' | 'investor'",
  {
    type: z
      .enum(["hardware", "model", "investor"])
      .describe("Producer type: hardware, model, or investor"),
    id: z.string().describe("Producer ID (e.g. 'mac_mini', 'gpt2', 'moms_card')"),
    quantity: z.number().int().min(1).max(100).optional().default(1).describe("How many to buy"),
  },
  async ({ type, id, quantity }) => {
    try {
      const state = await apiPost<{ tokens: string; tokensPerSecond: string }>(
        `/buy/${playerId()}`,
        { producerType: type, id, quantity }
      );
      return {
        content: [
          {
            type: "text",
            text: `Bought ${quantity}x ${id}. Tokens remaining: ${state.tokens}, Tokens/s: ${state.tokensPerSecond}`,
          },
        ],
      };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }] };
    }
  }
);

// ─── buy_upgrade ──────────────────────────────────────────────────────────────

server.tool(
  "buy_upgrade",
  "Buy a one-time upgrade by ID",
  { id: z.string().describe("Upgrade ID (e.g. 'better_prompts', 'quantization')") },
  async ({ id }) => {
    try {
      const state = await apiPost<{ tokensPerSecond: string }>(
        `/buy/${playerId()}`,
        { producerType: "upgrade", id }
      );
      return {
        content: [{ type: "text", text: `Bought upgrade: ${id}. Tokens/s now: ${state.tokensPerSecond}` }],
      };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }] };
    }
  }
);

// ─── prestige ─────────────────────────────────────────────────────────────────

server.tool(
  "prestige",
  "Go IPO — reset resources but keep Reputation for a permanent multiplier. Only call when get_available_actions shows type=prestige with affordable=true.",
  {},
  async () => {
    try {
      const state = await apiPost<{ prestigeCount: number; reputation: number; tokensPerSecond: string }>(
        `/prestige/${playerId()}`
      );
      return {
        content: [
          {
            type: "text",
            text: `IPO complete! You are now a ${state.prestigeCount}x founder. Reputation: ${state.reputation}. Tokens/s: ${state.tokensPerSecond}`,
          },
        ],
      };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }] };
    }
  }
);

// ─── spend_on_marketing ───────────────────────────────────────────────────────

server.tool(
  "spend_on_marketing",
  "Spend 10 funding to instantly gain +1 hype. Requires at least 10 funding in balance.",
  {},
  async () => {
    try {
      const state = await apiPost<{ hype: number; funding: string }>(
        `/marketing/${playerId()}`
      );
      return {
        content: [
          {
            type: "text",
            text: `Marketing spend! Hype: ${state.hype}, Funding remaining: ${state.funding}`,
          },
        ],
      };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }] };
    }
  }
);

// ─── get_leaderboard ──────────────────────────────────────────────────────────

server.tool("get_leaderboard", "Get the top 20 players on the global leaderboard", {}, async () => {
  try {
    const board = await apiGet("/leaderboard");
    return { content: [{ type: "text", text: JSON.stringify(board, null, 2) }] };
  } catch (e) {
    return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }] };
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

async function main() {
  await authenticate();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`t'kkens MCP server running (stdio) → ${API}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
