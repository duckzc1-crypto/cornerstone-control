// The browser's clock can be wrong (wrong time zone, daylight-saving set badly, drifted).
// Every "how old is this" figure must come from the SERVER's clock, so each API response carries
// the server's time and we remember the difference. Use nowS() instead of Date.now().
let skewS = 0;

/** Called with the x-server-time header (epoch seconds) of every API response. */
export function noteServerTime(header: string | null): void {
  const s = Number(header);
  if (Number.isFinite(s) && s > 1e9) skewS = s - Date.now() / 1000;
}

/** Current time in epoch seconds, corrected to the server's clock. */
export function nowS(): number {
  return Date.now() / 1000 + skewS;
}
