import { AeCampaign } from "./api";

export type Tier = "manual" | "priority" | "normal";

/** How many of each watched profile's newest posts are served first. This mirrors the server's
 *  AUTOX_PRIORITY_NEWEST setting (default 2). */
export const PRIORITY_PER_PROFILE = 2;

/** Bigger = newer post. X post ids are time-ordered; fall back to the start time if one isn't numeric. */
function newer(a: AeCampaign, b: AeCampaign): number {
  try {
    const x = BigInt(a.tweet_id);
    const y = BigInt(b.tweet_id);
    return y > x ? 1 : y < x ? -1 : 0;
  } catch {
    return b.started_at - a.started_at;
  }
}

/**
 * The order the fleet works posts in, the same rule the server uses:
 *   1. posts you added by hand
 *   2. the newest PRIORITY_PER_PROFILE posts of each watched profile, newest first
 *   3. everything else, oldest first (they age out soonest)
 */
export function workingOrder(running: AeCampaign[], perProfile: number = PRIORITY_PER_PROFILE): { c: AeCampaign; tier: Tier }[] {
  const byProfile = new Map<string, AeCampaign[]>();
  for (const c of running) {
    if (c.manual) continue;
    const key = c.target.toLowerCase();
    const list = byProfile.get(key);
    if (list) list.push(c);
    else byProfile.set(key, [c]);
  }
  const priority = new Set<string>();
  if (perProfile > 0) {
    byProfile.forEach((list) => {
      [...list].sort(newer).slice(0, perProfile).forEach((c) => priority.add(c.tweet_id));
    });
  }
  const manual = running.filter((c) => c.manual).sort(newer);
  const first = running.filter((c) => !c.manual && priority.has(c.tweet_id)).sort(newer);
  const rest = running.filter((c) => !c.manual && !priority.has(c.tweet_id)).sort((a, b) => a.started_at - b.started_at);
  return [
    ...manual.map((c) => ({ c, tier: "manual" as Tier })),
    ...first.map((c) => ({ c, tier: "priority" as Tier })),
    ...rest.map((c) => ({ c, tier: "normal" as Tier })),
  ];
}
