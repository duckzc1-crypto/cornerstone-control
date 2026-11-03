"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight } from "@phosphor-icons/react";
import { api, MetricsResp } from "../lib/api";
import { fmtCount, fmtEta, fmtFull } from "../lib/format";
import { usePoll } from "../lib/usePoll";
import { workingOrder } from "../lib/order";
import { Card, Empty, Freshness, Notice, PageHeader, Skeleton, Stat } from "../components/ui";
import { PostListHeader, PostRow } from "../components/PostRow";
import { Bar, BarChart } from "../components/BarChart";

function dailyBars(m: MetricsResp | null): Bar[] {
  if (!m) return [];
  const by = new Map<string, number>();
  for (const rows of Object.values(m.series)) {
    for (const r of rows) by.set(r.bucket, (by.get(r.bucket) ?? 0) + r.views);
  }
  return [...by.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-14)
    .map(([bucket, value]) => ({ label: bucket.length >= 10 ? bucket.slice(5, 10) : bucket, value }));
}

export default function OverviewPage() {
  const ae = usePoll(api.getAutoEngage, 15_000);
  const fleet = usePoll(api.getFleet, 10_000);
  const metrics = usePoll(() => api.getMetrics("day", "post"), 60_000);

  const running = useMemo(() => (ae.data?.campaigns ?? []).filter((c) => c.status === "running"), [ae.data]);
  const ordered = useMemo(() => workingOrder(running), [running]);
  const boosting = running.filter((c) => c.active).length;
  const waiting = running.length - boosting;
  const tp = ae.data?.throughput;
  const speed = fleet.data?.views_per_min ?? tp?.views_per_min ?? null;
  const eta = fleet.data?.eta_hours ?? tp?.eta_hours ?? null;
  const remaining = fleet.data?.remaining ?? tp?.remaining_views ?? null;
  const days = useMemo(() => dailyBars(metrics.data), [metrics.data]);

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle="Is the fleet working, and how close are the posts to their goals?"
        right={<Freshness updatedAt={ae.updatedAt} error={ae.error} />}
      />

      {ae.data && !ae.data.config.enabled && (
        <div className="mb-5">
          <Notice tone="warn">
            Auto-engage is <span className="font-semibold">paused</span>. New posts from your watched profiles won&rsquo;t be picked up
            until you turn it on in Settings.
          </Notice>
        </div>
      )}

      <div className="space-y-5">
        <Card>
          {ae.loading && !ae.data ? (
            <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-6 gap-y-6 lg:grid-cols-4">
              <Stat
                label="Views per minute"
                tone={speed ? "ok" : "neutral"}
                value={speed != null ? fmtCount(speed) : "—"}
                sub={
                  fleet.data?.rate_source === "x_counts"
                    ? `measured from X's counts over ${fleet.data.rate_window_min ?? 30} min`
                    : "recent fleet speed"
                }
              />
              <Stat label="Time to finish" value={fmtEta(eta)} sub="all posts, at the current speed" />
              <Stat label="Views still wanted" value={remaining != null ? fmtCount(remaining) : "—"} sub={remaining != null ? `${fmtFull(remaining)} in total` : undefined} />
              <Stat
                label="Posts running"
                value={running.length}
                sub={`${boosting} getting views · ${waiting} waiting`}
              />
            </div>
          )}
        </Card>

        <Card
          title="Working order"
          subtitle="The fleet serves the 2 newest posts of each profile first (and anything you added by hand), then the rest, oldest first."
          action={
            <Link href="/posts" className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
              All posts <ArrowRight />
            </Link>
          }
        >
          {running.length === 0 ? (
            <Empty>
              Nothing is being boosted. When a watched profile posts under the view limit, or when you add a post, it shows up here.
            </Empty>
          ) : (
            <>
              <PostListHeader />
              <ul className="divide-y divide-ink-line">
                {ordered.slice(0, 8).map(({ c, tier }, i) => (
                  <PostRow key={c.tweet_id} c={c} rank={i + 1} tier={tier} />
                ))}
              </ul>
              {running.length > 8 && <p className="mt-3 text-xs text-subtle">and {running.length - 8} more on the Posts page.</p>}
            </>
          )}
        </Card>

        <Card title="Views per day" subtitle="Recorded from X's public view counts across all posts, last 14 days.">
          {metrics.data && days.length > 0 ? (
            <BarChart data={days} />
          ) : metrics.error && !metrics.data ? (
            <Empty>The daily history isn&rsquo;t available right now.</Empty>
          ) : (
            <Skeleton className="h-36" />
          )}
        </Card>

        <Card title="How to read these numbers">
          <ul className="space-y-2 text-sm leading-relaxed text-muted">
            <li>
              <span className="font-medium text-fg">Views, likes, reposts, comments on X</span> are read from X itself, so they
              include organic activity as well as ours. Nothing here is a count of &ldquo;attempts sent&rdquo;, because X quietly
              drops some of those.
            </li>
            <li>
              <span className="font-medium text-fg">Goal</span> is what the fleet is aiming for on that post. A number in green
              means the post has reached it.
            </li>
            <li>
              <span className="font-medium text-fg">Getting views</span> vs <span className="font-medium text-fg">Waiting</span>: the
              fleet delivers views to a limited number of posts at a time. Waiting posts still receive likes, reposts and comments.
            </li>
          </ul>
        </Card>
      </div>
    </>
  );
}
