import { useState, useEffect } from "react";
import type { GameState } from "@ai-hype/shared";

export interface Hint {
  id: string;
  text: string;
}

const HINTS: { id: string; text: string; condition: (s: GameState) => boolean }[] = [
  {
    id: "hint_start",
    text: "start by clicking generate a few times, then buy a Mac Mini.",
    condition: (s) => s.totalClicks === 0,
  },
  {
    id: "hint_first_hw",
    text: "now buy GPT-2 — it turns Compute into Tokens automatically.",
    condition: (s) => s.hardware.mac_mini >= 1 && s.models.gpt2 === 0,
  },
  {
    id: "hint_first_model",
    text: "watch your tokens/s go up. keep hardware ahead of models.",
    condition: (s) => s.models.gpt2 >= 1 && s.totalTokensEarned.lt(500),
  },
  {
    id: "hint_first_milestone",
    text: "that's hype. it multiplies everything. chase more milestones.",
    condition: (s) => s.milestonesHit.length === 1,
  },
];

export function useFirstTimeHints(state: GameState | null): Hint | null {
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("ai_hype_hints");
      return new Set(stored ? (JSON.parse(stored) as string[]) : []);
    } catch {
      return new Set();
    }
  });

  const [activeHint, setActiveHint] = useState<Hint | null>(null);

  useEffect(() => {
    if (!state) return;
    for (const hint of HINTS) {
      if (!dismissed.has(hint.id) && hint.condition(state)) {
        setActiveHint({ id: hint.id, text: hint.text });
        return;
      }
    }
    setActiveHint(null);
  }, [state, dismissed]);

  function dismiss(id: string) {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      localStorage.setItem("ai_hype_hints", JSON.stringify([...next]));
      return next;
    });
    setActiveHint(null);
  }

  return activeHint
    ? { ...activeHint, dismiss: () => dismiss(activeHint.id) } as Hint & { dismiss: () => void }
    : null;
}
