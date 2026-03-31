import { useState } from "react";
import { useGame } from "./hooks/useGame.js";
import { Register } from "./components/Register.js";
import { ResourceBar } from "./components/ResourceBar.js";
import { ClickButton } from "./components/ClickButton.js";
import { ProducerPanel } from "./components/ProducerPanel.js";
import { UpgradePanel } from "./components/UpgradePanel.js";
import { MilestoneLog } from "./components/MilestoneLog.js";
import { Leaderboard } from "./components/Leaderboard.js";
import { PrestigeModal } from "./components/PrestigeModal.js";
import { getFounderTitle } from "@ai-hype/shared";

export default function App() {
  const { playerId, playerName, state, leaderboard, milestones, connected, register, doClick, buy, doPrestige } =
    useGame();
  const [showPrestige, setShowPrestige] = useState(false);
  const [tab, setTab] = useState<"game" | "leaderboard">("game");

  if (!playerId) {
    return <Register onRegister={register} />;
  }

  if (!state) {
    return (
      <div className="loading">
        <span>connecting{connected ? "" : "..."}</span>
      </div>
    );
  }

  const handleBuy = (producerType: string, id: string) => {
    buy(producerType, id);
  };

  const handleUpgrade = (id: string) => {
    buy("upgrade", id);
  };

  const handlePrestige = async () => {
    await doPrestige();
    setShowPrestige(false);
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <span className="game-title">AI HYPE MACHINE</span>
          <span className="player-info">
            {playerName} · {getFounderTitle(state.prestigeCount)}
            {state.prestigeCount > 0 && ` · ${state.prestigeCount}× founder`}
          </span>
        </div>
        <div className="header-right">
          <span className={`conn-dot ${connected ? "on" : "off"}`} title={connected ? "connected" : "reconnecting"} />
          <nav>
            <button className={tab === "game" ? "active" : ""} onClick={() => setTab("game")}>game</button>
            <button className={tab === "leaderboard" ? "active" : ""} onClick={() => setTab("leaderboard")}>board</button>
          </nav>
        </div>
      </header>

      <ResourceBar state={state} />

      {tab === "game" ? (
        <main className="game-layout">
          <div className="left-col">
            <ClickButton state={state} onClick={doClick} />
            <UpgradePanel state={state} onBuy={handleUpgrade} />
            <MilestoneLog milestones={milestones} />
            {state.totalTokensEarned >= 1_000_000 && (
              <button className="prestige-btn" onClick={() => setShowPrestige(true)}>
                ★ launch a startup
              </button>
            )}
          </div>
          <div className="right-col">
            <ProducerPanel state={state} onBuy={handleBuy} />
          </div>
        </main>
      ) : (
        <div className="board-layout">
          <Leaderboard entries={leaderboard} currentPlayerId={playerId} />
        </div>
      )}

      {showPrestige && (
        <PrestigeModal
          state={state}
          onConfirm={handlePrestige}
          onCancel={() => setShowPrestige(false)}
        />
      )}
    </div>
  );
}
