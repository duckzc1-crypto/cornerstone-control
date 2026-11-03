"use client";

import { useEffect, useState } from "react";
import { ArrowSquareOut, Eye, Heart, Repeat, ChatCircle, Prohibit } from "@phosphor-icons/react";
import { AeCampaign } from "../lib/api";
import { ageSince, fmtAge, fmtCount } from "../lib/format";
import { Btn, Pill, Progress, Tone } from "./ui";
import { Tier } from "../lib/order";

export type CampaignState = "boosting" | "queued" | "done" | "stopped" | "deleted";

export function stateOf(c: AeCampaign): CampaignState {
  if (c.status === "running") return c.active ? "boosting" : "queued";
  if (c.status === "done") return "done";
  if (c.status === "deleted") return "deleted";
  return "stopped";
}

const STATE_META: Record<CampaignState, { label: string; tone: Tone; help: string }> = {
  boosting: { label: "Getting views", tone: "ok", help: "The fleet is delivering views to this post right now." },
  queued: { label: "Waiting", tone: "neutral", help: "Still running, but waiting for its turn at views. It already gets likes, reposts and comments." },
  done: { label: "Finished", tone: "ok", help: "Reached its goal, or ran out of time." },
  stopped: { label: "Stopped", tone: "neutral", help: "Stopped by you." },
  deleted: { label: "Deleted on X", tone: "bad", help: "The post no longer exists on X." },
};

export function StatePill({ state }: { state: CampaignState }) {
  const m = STATE_META[state];
  return (
    <span title={m.help}>
      <Pill tone={m.tone}>{m.label}</Pill>
    </span>
  );
}

/** One counter: what is on X right now, over the goal the fleet is aiming for. */
function Count({ icon, now, goal, label }: { icon: React.ReactNode; now: number; goal: number; label: string }) {
  const reached = goal > 0 && now >= goal;
  return (
    <span className={`inline-flex items-center gap-1 ${reached ? "text-accent" : "text-muted"}`} title={`${label}: ${now} on X now, goal ${goal}`}>
      {icon}
      <span className="tnum font-mono text-xs">
        {now}
        <span className="text-faint">/{goal}</span>
      </span>
    </span>
  );
}

export function PostRow({
  c,
  rank,
  tier,
  onStop,
}: {
  c: AeCampaign;
  rank?: number;
  tier?: Tier;
  onStop?: (c: AeCampaign) => void;
}) {
  const state = stateOf(c);
  const live = c.status === "running";
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    if (!confirm) return;
    const t = setTimeout(() => setConfirm(false), 4000);
    return () => clearTimeout(t);
  }, [confirm]);

  return (
    <li className="grid gap-x-4 gap-y-2 py-3 sm:grid-cols-[2rem_minmax(0,1.3fr)_minmax(0,1.2fr)_auto] sm:items-center">
      <div className="tnum hidden font-mono text-xs text-faint sm:block">{rank != null ? `#${rank}` : ""}</div>

      <div className="min-w-0">
        <a href={c.url} target="_blank" rel="noreferrer" className="group inline-flex max-w-full items-center gap-1.5 text-sm font-medium hover:text-accent">
          <span className="truncate">@{c.target}</span>
          <ArrowSquareOut className="shrink-0 text-faint group-hover:text-accent" />
        </a>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-subtle">
          <span className="font-mono">#{c.tweet_id.slice(-8)}</span>
          <span>started {fmtAge(ageSince(c.started_at))} ago</span>
          {tier === "priority" && <span className="font-medium text-accent">priority: newest of this profile</span>}
          {c.manual && <span className="text-accent">added by you</span>}
        </div>
      </div>

      <div className="min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-accent">
            <Eye weight="fill" />
            <span className="tnum font-mono text-sm font-semibold">{fmtCount(c.views_done)}</span>
          </span>
          <span className="tnum font-mono text-[11px] text-subtle">goal {fmtCount(c.view_target)}</span>
        </div>
        <div className="mt-1.5">
          <Progress value={c.views_done} max={c.view_target} tone={state === "deleted" ? "bad" : "ok"} />
        </div>
        <div className="mt-1.5 flex items-center gap-4">
          <Count icon={<Heart className="text-faint" />} now={c.done.like} goal={c.plan.likes} label="Likes" />
          <Count icon={<Repeat className="text-faint" />} now={c.done.repost} goal={c.plan.reposts} label="Reposts" />
          <Count icon={<ChatCircle className="text-faint" />} now={c.done.comment} goal={c.plan.comments} label="Comments" />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <StatePill state={state} />
        {live && onStop && (
          confirm ? (
            <span className="inline-flex items-center gap-1">
              <Btn variant="danger" className="!px-2.5 !py-1 text-xs" onClick={() => onStop(c)}>
                Stop
              </Btn>
              <button type="button" onClick={() => setConfirm(false)} className="px-1.5 text-xs text-subtle hover:text-fg">
                Cancel
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirm(true)}
              aria-label={`Stop boosting @${c.target} ${c.tweet_id.slice(-6)}`}
              title="Stop boosting this post"
              className="rounded-md p-1.5 text-faint transition hover:text-danger"
            >
              <Prohibit weight="bold" />
            </button>
          )
        )}
      </div>
    </li>
  );
}

export function PostListHeader() {
  return (
    <div className="hidden grid-cols-[2rem_minmax(0,1.3fr)_minmax(0,1.2fr)_auto] gap-x-4 border-b border-ink-line pb-2 text-[11px] uppercase tracking-[0.12em] text-subtle sm:grid">
      <span>#</span>
      <span>Post</span>
      <span>Views on X · likes · reposts · comments (now / goal)</span>
      <span className="text-right">Status</span>
    </div>
  );
}
