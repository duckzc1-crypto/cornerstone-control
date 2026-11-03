import { nowS } from "./clock";
/** 1234 -> "1.2K", 3_400_000 -> "3.4M", null -> "—". */
export function fmtCount(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return "—";
  if (n < 1000) return String(Math.round(n));
  if (n < 1_000_000) return (n / 1000).toFixed(n < 10_000 ? 1 : 0) + "K";
  return (n / 1_000_000).toFixed(1) + "M";
}

/** Full number with separators: 12345 -> "12,345". */
export function fmtFull(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return "—";
  return Math.round(n).toLocaleString("en-US");
}

/** Hours -> "3h 24m", 0.75 -> "45m"; unknown -> "—". */
export function fmtEta(hours: number | null | undefined): string {
  if (hours == null || !isFinite(hours) || hours < 0) return "—";
  const total = Math.round(hours * 60);
  if (total < 1) return "<1m";
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (h >= 48) return `${Math.round(h / 24)}d`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Seconds -> "45s", "12m", "3.2h", "2d". */
export function fmtAge(seconds: number | null | undefined): string {
  if (seconds == null || !isFinite(seconds) || seconds < 0) return "—";
  if (seconds < 90) return `${Math.round(seconds)}s`;
  if (seconds < 5400) return `${Math.round(seconds / 60)}m`;
  if (seconds < 172800) return `${(seconds / 3600).toFixed(1)}h`;
  return `${Math.round(seconds / 86400)}d`;
}

/** Epoch seconds -> age in seconds from now. */
export function ageSince(epochSeconds: number): number {
  return nowS() - epochSeconds;
}

export const POST_RE = /(?:x|twitter)\.com\/([^/\s]+)\/status\/(\d+)/i;
