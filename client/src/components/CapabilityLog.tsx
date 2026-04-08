import { useState, useEffect, useRef } from "react";
import type { CapabilityMessage } from "@ai-hype/shared";
import { CAPABILITY_MESSAGES } from "@ai-hype/shared";
import type Decimal from "break_eternity.js";

interface Props {
  tokensPerSecond: Decimal;
  computePerSecond: Decimal;
  totalTokensEarned: Decimal;
}

const MAX_MESSAGES = 10;

function computeScore(tokensPerSecond: Decimal, computePerSecond: Decimal): number {
  const tps = Math.max(0, tokensPerSecond.toNumber());
  const cps = Math.max(0, computePerSecond.toNumber());
  return tps + cps * 10;
}

export function CapabilityLog({ tokensPerSecond, computePerSecond, totalTokensEarned }: Props) {
  const [messages, setMessages] = useState<string[]>([]);
  const shownIndices = useRef<Set<number>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scoreRef = useRef(0);
  scoreRef.current = computeScore(tokensPerSecond, computePerSecond);

  // Track tokens earned at the time of the last shown message
  const lastTokensRef = useRef<number>(0);
  const totalTokensRef = useRef<number>(0);
  totalTokensRef.current = totalTokensEarned.toNumber();

  useEffect(() => {
    function scheduleNext() {
      const delay = 15_000 + Math.random() * 10_000; // 15–25s
      timerRef.current = setTimeout(() => {
        const score = scoreRef.current;
        const currentTotal = totalTokensRef.current;

        // Only show a message if tokens have actually been earned since last message
        if (currentTotal <= lastTokensRef.current || score <= 0) {
          scheduleNext();
          return;
        }

        const pool = CAPABILITY_MESSAGES
          .map((m, i) => ({ m, i }))
          .filter(({ m, i }) => m.minScore <= score && !shownIndices.current.has(i));

        if (pool.length > 0) {
          const pick = pool[Math.floor(Math.random() * pool.length)];
          shownIndices.current.add(pick.i);
          lastTokensRef.current = currentTotal;
          setMessages((prev) => [pick.m.text, ...prev].slice(0, MAX_MESSAGES));
        }

        scheduleNext();
      }, delay);
    }

    scheduleNext();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []); // run once on mount

  if (messages.length === 0) return null;

  return (
    <div className="capability-log">
      {messages.map((msg, i) => (
        <div key={i} className="capability-line">
          &gt; {msg}
        </div>
      ))}
    </div>
  );
}
