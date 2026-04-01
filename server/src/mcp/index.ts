/**
 * MCP server for AI Hype Machine.
 * Runs as a separate process using stdio transport.
 * Connect via: node server/dist/mcp/index.js
 *
 * Delegates all game actions to the HTTP server at localhost:PORT so that
 * changes go through the shared in-memory session store and are pushed to
 * the browser via WebSocket on the next tick.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const MCP_PLAYER_ID = process.env.MCP_PLAYER_ID ?? "mcp-bot";
const PORT = process.env.PORT ?? "3000";
const API = `http://localhost:${PORT}/api`;

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
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error: string }).error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

const server = new McpServer({
  name: "ai-hype-machine",
  version: "1.0.0",
});

// ─── get_game_state ───────────────────────────────────────────────────────────

server.tool("get_game_state", "Get the full current game state", {}, async () => {
  try {
    const state = await apiGet(`/state/${MCP_PLAYER_ID}`);
    return { content: [{ type: "text", text: JSON.stringify(state, null, 2) }] };
  } catch (e) {
    return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }] };
  }
});

// ─── get_available_actions ────────────────────────────────────────────────────

server.tool(
  "get_available_actions",
  "Get all available actions with cost, tokens/s gain, and payback period. Use this to decide what to buy.",
  {},
  async () => {
    try {
      const actions = await apiGet(`/actions/${MCP_PLAYER_ID}`);
      return { content: [{ type: "text", text: JSON.stringify(actions, null, 2) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }] };
    }
  }
);

// ─── click ────────────────────────────────────────────────────────────────────

server.tool("click", "Perform a single manual click to earn tokens", {}, async () => {
  try {
    const state = await apiPost<{ tokens: number; clickPower: number }>(
      `/click/${MCP_PLAYER_ID}`,
      { n: 1 }
    );
    return {
      content: [
        {
          type: "text",
          text: `Clicked! Tokens: ${state.tokens.toFixed(2)}, Click power: ${state.clickPower.toFixed(2)}`,
        },
      ],
    };
  } catch (e) {
    return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }] };
  }
});

// ─── click_n ──────────────────────────────────────────────────────────────────

server.tool(
  "click_n",
  "Perform multiple clicks at once (max 1000)",
  { n: z.number().int().min(1).max(1000).describe("Number of clicks") },
  async ({ n }) => {
    try {
      const state = await apiPost<{ tokens: number }>(`/click/${MCP_PLAYER_ID}`, { n });
      return {
        content: [{ type: "text", text: `Clicked ${n} times! Tokens: ${state.tokens.toFixed(2)}` }],
      };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }] };
    }
  }
);

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
      const state = await apiPost<{ tokens: number; tokensPerSecond: number }>(
        `/buy/${MCP_PLAYER_ID}`,
        { producerType: type, id, quantity }
      );
      return {
        content: [
          {
            type: "text",
            text: `Bought ${quantity}x ${id}. Tokens remaining: ${state.tokens.toFixed(2)}, Tokens/s: ${state.tokensPerSecond.toFixed(2)}`,
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
      const state = await apiPost<{ tokensPerSecond: number }>(
        `/buy/${MCP_PLAYER_ID}`,
        { producerType: "upgrade", id }
      );
      return {
        content: [{ type: "text", text: `Bought upgrade: ${id}. Tokens/s now: ${state.tokensPerSecond.toFixed(2)}` }],
      };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }] };
    }
  }
);

// ─── prestige ─────────────────────────────────────────────────────────────────

server.tool(
  "prestige",
  "Launch a Startup — reset resources but keep Reputation for a permanent multiplier",
  {},
  async () => {
    try {
      const state = await apiPost<{ prestigeCount: number; reputation: number }>(
        `/prestige/${MCP_PLAYER_ID}`
      );
      return {
        content: [
          {
            type: "text",
            text: `Prestige! You are now a ${state.prestigeCount}x founder. Reputation: ${state.reputation}`,
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
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("AI Hype Machine MCP server running (stdio)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
