import { useState } from "react";
import type { GameState } from "@ai-hype/shared";
import { fmt } from "../lib/format.js";

interface Props {
  state: GameState;
  onClick: (n?: number) => void;
}

export function ClickButton({ state, onClick }: Props) {
  const [pop, setPop] = useState<{ id: number; value: string } | null>(null);
  let popId = 0;

  const handleClick = () => {
    onClick();
    const id = ++popId;
    setPop({ id, value: `+${fmt(state.clickPower)}` });
    setTimeout(() => setPop((p) => (p?.id === id ? null : p)), 600);
  };

  return (
    <div className="click-area">
      <button className="click-btn" onClick={handleClick}>
        <span className="click-label">generate</span>
        <span className="click-sub">tokens</span>
      </button>
      {pop && (
        <span key={pop.id} className="click-pop">
          {pop.value}
        </span>
      )}
      <div className="click-stats">
        <span>{fmt(state.clickPower)} / click</span>
        <span>{fmt(state.totalClicks)} total clicks</span>
      </div>
    </div>
  );
}
