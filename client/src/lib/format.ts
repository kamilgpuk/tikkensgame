import Decimal from "break_eternity.js";

export function fmt(n: Decimal | number): string {
  const d = n instanceof Decimal ? n : new Decimal(n);
  if (!d.isFinite()) return "0";
  if (d.lt(1_000)) return d.toNumber().toFixed(d.lt(10) ? 1 : 0);
  if (d.lt(1_000_000)) return (d.toNumber() / 1_000).toFixed(1) + "K";
  if (d.lt(1_000_000_000)) return (d.toNumber() / 1_000_000).toFixed(1) + "M";
  if (d.lt(1e12)) return (d.toNumber() / 1_000_000_000).toFixed(1) + "B";
  if (d.lt(1e15)) return (d.toNumber() / 1e12).toFixed(1) + "T";
  return d.toExponential(2);
}

export function fmtRate(n: Decimal | number): string {
  return fmt(n) + "/s";
}

export function fmtTime(seconds: number): string {
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h`;
}
