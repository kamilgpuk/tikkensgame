import { useState, useEffect, useRef, useCallback } from "react";
import type { GameState, LeaderboardEntry, ServerMessage } from "@ai-hype/shared";
import { api } from "../lib/api.js";

const PLAYER_ID_KEY = "ai_hype_player_id";
const PLAYER_NAME_KEY = "ai_hype_player_name";

export interface MilestoneEvent {
  id: string;
  message: string;
  hypeGain: number;
  ts: number;
}

export function useGame() {
  const [playerId, setPlayerId] = useState<string | null>(
    () => localStorage.getItem(PLAYER_ID_KEY)
  );
  const [playerName, setPlayerName] = useState<string>(
    () => localStorage.getItem(PLAYER_NAME_KEY) ?? ""
  );
  const [state, setState] = useState<GameState | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [milestones, setMilestones] = useState<MilestoneEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback((pid: string, pname: string) => {
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const host = window.location.host;
    const ws = new WebSocket(
      `${proto}://${host}/ws?playerId=${encodeURIComponent(pid)}&playerName=${encodeURIComponent(pname)}`
    );
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      // Reconnect after 2s
      setTimeout(() => connect(pid, pname), 2000);
    };
    ws.onerror = () => ws.close();

    ws.onmessage = (evt) => {
      const msg = JSON.parse(evt.data as string) as ServerMessage;
      if (msg.type === "state") setState(msg.payload);
      if (msg.type === "leaderboard") setLeaderboard(msg.payload);
      if (msg.type === "milestone") {
        setMilestones((prev) => [
          { ...msg.payload, ts: Date.now() },
          ...prev.slice(0, 19),
        ]);
      }
    };
  }, []);

  // Auto-connect if we have a playerId
  useEffect(() => {
    if (playerId && playerName) connect(playerId, playerName);
    return () => wsRef.current?.close();
  }, [playerId, playerName, connect]);

  const register = useCallback(async (name: string) => {
    const { playerId: pid } = await api.createPlayer(name);
    localStorage.setItem(PLAYER_ID_KEY, pid);
    localStorage.setItem(PLAYER_NAME_KEY, name);
    setPlayerId(pid);
    setPlayerName(name);
  }, []);

  const doClick = useCallback(
    async (n = 1) => {
      if (!playerId) return;
      // Optimistic update handled by WS push; just fire request
      await api.click(playerId, n).catch(() => null);
    },
    [playerId]
  );

  const buy = useCallback(
    async (producerType: string, id: string, quantity = 1) => {
      if (!playerId) return;
      await api.buy(playerId, producerType, id, quantity).catch(() => null);
    },
    [playerId]
  );

  const doPrestige = useCallback(async () => {
    if (!playerId) return;
    await api.prestige(playerId).catch(() => null);
  }, [playerId]);

  return {
    playerId,
    playerName,
    state,
    leaderboard,
    milestones,
    connected,
    register,
    doClick,
    buy,
    doPrestige,
  };
}
