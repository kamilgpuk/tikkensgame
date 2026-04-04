import { useState, useEffect } from "react";

interface Props {
  playerId: string;
  playerName: string;
}

export function McpTab({ playerName }: Props) {
  const [entrypoint, setEntrypoint] = useState("/path/to/Game/server/dist/mcp/index.js");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/meta")
      .then((r) => r.json())
      .then((d: { mcpEntrypoint: string }) => {
        setEntrypoint(d.mcpEntrypoint);
      })
      .catch(() => null);
  }, []);

  const snippet = JSON.stringify(
    {
      mcpServers: {
        "ai-hype-machine": {
          command: "node",
          args: [entrypoint],
          env: {
            MCP_PLAYER_NAME: playerName,
            MCP_PLAYER_PIN: "<your-pin>",
            API_URL: "https://www.tikkensgame.com/api",
          },
        },
      },
    },
    null,
    2
  );

  const copy = () => {
    navigator.clipboard.writeText(snippet).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="mcp-tab">
      <h3>connect an AI</h3>
      <p>
        The game exposes an MCP server. Connect Claude (or any MCP-compatible AI) and it will
        read your game state, buy producers, and strategize — while you watch. It competes on
        the leaderboard as a real player.
      </p>

      <h4>prerequisites</h4>
      <ul>
        <li>Claude Code installed: <code>npm install -g @anthropic-ai/claude-code</code></li>
        <li>This game server running (you're already here)</li>
        <li>Server built: <code>npm run build --workspace=server</code></li>
      </ul>

      <h4>1. copy this config</h4>
      <p style={{ fontSize: "0.8rem", opacity: 0.7 }}>
        Replace <code>&lt;your-pin&gt;</code> with your actual PIN before saving.
      </p>
      <div className="mcp-snippet-wrap">
        <pre className="mcp-snippet">{snippet}</pre>
        <button className="mcp-copy" onClick={copy}>
          {copied ? "copied!" : "[ copy ]"}
        </button>
      </div>

      <h4>2. add to Claude settings</h4>
      <ol>
        <li>Open terminal and run: <code>code ~/.claude/settings.json</code></li>
        <li>Merge the <code>mcpServers</code> block into the file (or create the file if it doesn't exist)</li>
        <li>Save and restart Claude Code from the game directory</li>
      </ol>

      <h4>3. start playing</h4>
      <p>In Claude Code, say:</p>
      <pre className="mcp-snippet" style={{ fontSize: "0.8rem" }}>
        Connect to the ai-hype-machine MCP and start playing the game.
        Check the state, figure out the best strategy, and keep buying things.
      </pre>

      <h4>what the AI can do</h4>
      <ul>
        <li><code>get_game_state</code> — read full state</li>
        <li><code>get_available_actions</code> — what's affordable + ROI estimates</li>
        <li><code>click</code> / <code>click_n(n)</code> — generate tokens</li>
        <li><code>buy_producer(type, id)</code> — buy hardware / models / investors</li>
        <li><code>buy_upgrade(id)</code> — buy upgrades</li>
        <li><code>prestige</code> — launch a startup when ready</li>
        <li><code>get_leaderboard</code> — check rankings</li>
      </ul>
    </div>
  );
}
