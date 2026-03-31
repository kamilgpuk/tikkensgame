/**
 * MCP server for AI Hype Machine.
 * Runs as a separate process using stdio transport.
 * Connect via: node server/dist/mcp/index.js
 *
 * The MCP server shares the same SQLite DB as the main server,
 * so actions taken here are reflected in the browser immediately (on next tick).
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import type { HardwareId, ModelId, InvestorId, UpgradeId } from "@ai-hype/shared";
import { getAvailableActions, computeScore } from "../game/engine.js";
import {
  loadOrCreateSession,
  doClick,
  doBuyHardware,
  doBuyModel,
  doBuyInvestor,
  doBuyUpgrade,
  doPrestige,
  startTickLoop,
} from "../game/session.js";
import { getLeaderboard } from "../db/index.js";

// The MCP player — a dedicated bot player
const MCP_PLAYER_ID = process.env.MCP_PLAYER_ID ?? "mcp-bot";
const MCP_PLAYER_NAME = process.env.MCP_PLAYER_NAME ?? "AI Bot";

// Ensure the bot has a session
loadOrCreateSession(MCP_PLAYER_ID, MCP_PLAYER_NAME);

// Run the tick loop so resources accumulate
startTickLoop();

const server = new McpServer({
  name: "ai-hype-machine",
  version: "1.0.0",
});

// ─── get_game_state ───────────────────────────────────────────────────────────

server.tool("get_game_state", "Get the full current game state", {}, async () => {
  const state = loadOrCreateSession(MCP_PLAYER_ID, MCP_PLAYER_NAME);
  return {
    content: [{ type: "text", text: JSON.stringify(state, null, 2) }],
  };
});

// ─── get_available_actions ────────────────────────────────────────────────────

server.tool(
  "get_available_actions",
  "Get all available actions with cost, tokens/s gain, and payback period. Use this to decide what to buy.",
  {},
  async () => {
    const state = loadOrCreateSession(MCP_PLAYER_ID, MCP_PLAYER_NAME);
    const actions = getAvailableActions(state);
    return {
      content: [{ type: "text", text: JSON.stringify(actions, null, 2) }],
    };
  }
);

// ─── click ────────────────────────────────────────────────────────────────────

server.tool("click", "Perform a single manual click to earn tokens", {}, async () => {
  const result = doClick(MCP_PLAYER_ID, 1);
  if (!result.ok) return { content: [{ type: "text", text: `Error: ${result.error}` }] };
  return {
    content: [
      {
        type: "text",
        text: `Clicked! Tokens: ${result.state.tokens.toFixed(2)}, Click power: ${result.state.clickPower.toFixed(2)}`,
      },
    ],
  };
});

// ─── click_n ──────────────────────────────────────────────────────────────────

server.tool(
  "click_n",
  "Perform multiple clicks at once (max 1000)",
  { n: z.number().int().min(1).max(1000).describe("Number of clicks") },
  async ({ n }) => {
    const result = doClick(MCP_PLAYER_ID, n);
    if (!result.ok) return { content: [{ type: "text", text: `Error: ${result.error}` }] };
    return {
      content: [
        {
          type: "text",
          text: `Clicked ${n} times! Tokens: ${result.state.tokens.toFixed(2)}`,
        },
      ],
    };
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
    let result;
    if (type === "hardware") result = doBuyHardware(MCP_PLAYER_ID, id as HardwareId, quantity);
    else if (type === "model") result = doBuyModel(MCP_PLAYER_ID, id as ModelId, quantity);
    else result = doBuyInvestor(MCP_PLAYER_ID, id as InvestorId, quantity);

    if (!result.ok) return { content: [{ type: "text", text: `Error: ${result.error}` }] };
    return {
      content: [
        {
          type: "text",
          text: `Bought ${quantity}x ${id}. Tokens remaining: ${result.state.tokens.toFixed(2)}, Tokens/s: ${result.state.tokensPerSecond.toFixed(2)}`,
        },
      ],
    };
  }
);

// ─── buy_upgrade ──────────────────────────────────────────────────────────────

server.tool(
  "buy_upgrade",
  "Buy a one-time upgrade by ID",
  { id: z.string().describe("Upgrade ID (e.g. 'better_prompts', 'quantization')") },
  async ({ id }) => {
    const result = doBuyUpgrade(MCP_PLAYER_ID, id as UpgradeId);
    if (!result.ok) return { content: [{ type: "text", text: `Error: ${result.error}` }] };
    return {
      content: [
        {
          type: "text",
          text: `Bought upgrade: ${id}. Tokens/s now: ${result.state.tokensPerSecond.toFixed(2)}`,
        },
      ],
    };
  }
);

// ─── prestige ─────────────────────────────────────────────────────────────────

server.tool(
  "prestige",
  "Launch a Startup — reset resources but keep Reputation for a permanent multiplier",
  {},
  async () => {
    const result = doPrestige(MCP_PLAYER_ID);
    if (!result.ok) return { content: [{ type: "text", text: `Error: ${result.error}` }] };
    return {
      content: [
        {
          type: "text",
          text: `Prestige! You are now a ${result.state.prestigeCount}x founder. Reputation: ${result.state.reputation}`,
        },
      ],
    };
  }
);

// ─── get_leaderboard ──────────────────────────────────────────────────────────

server.tool("get_leaderboard", "Get the top 20 players on the global leaderboard", {}, async () => {
  const board = getLeaderboard(20);
  return {
    content: [{ type: "text", text: JSON.stringify(board, null, 2) }],
  };
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
