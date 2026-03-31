export function fmt(n: number): string {
  if (!isFinite(n) || isNaN(n)) return "0";
  if (n < 1_000) return n.toFixed(n < 10 ? 1 : 0);
  if (n < 1_000_000) return (n / 1_000).toFixed(1) + "K";
  if (n < 1_000_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n < 1e12) return (n / 1_000_000_000).toFixed(1) + "B";
  if (n < 1e15) return (n / 1e12).toFixed(1) + "T";
  return n.toExponential(2);
}

export function fmtRate(n: number): string {
  return fmt(n) + "/s";
}

export function fmtTime(seconds: number): string {
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h`;
}
