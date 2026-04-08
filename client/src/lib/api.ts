const BASE = "/api";

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error: string }).error);
  }
  return res.json() as Promise<T>;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(res.statusText);
  return res.json() as Promise<T>;
}

export const api = {
  createPlayer: (playerName: string, pin: string) =>
    post<{ playerId: string; nameTaken: boolean }>("/players", { playerName, pin }),
  login: (playerName: string, pin: string) =>
    post<{ playerId: string }>("/auth", { playerName, pin }),
  click: (playerId: string, n = 1) =>
    post(`/click/${playerId}`, { n }),
  buy: (playerId: string, producerType: string, id: string, quantity = 1) =>
    post(`/buy/${playerId}`, { producerType, id, quantity }),
  prestige: (playerId: string) =>
    post(`/prestige/${playerId}`),
  marketing: (playerId: string) =>
    post(`/marketing/${playerId}`),
  leaderboard: () =>
    get("/leaderboard"),
};
