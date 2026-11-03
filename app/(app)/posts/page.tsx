"use client";

import { useMemo, useState } from "react";
import { api, AeCampaign } from "../../lib/api";
import { usePoll } from "../../lib/usePoll";
import { workingOrder } from "../../lib/order";
import { Card, Empty, Freshness, Notice, PageHeader, Segmented, Skeleton } from "../../components/ui";
import { BoostPost } from "../../components/BoostPost";
import { PostListHeader, PostRow } from "../../components/PostRow";

type Tab = "active" | "finished";

export default function PostsPage() {
  const ae = usePoll(api.getAutoEngage, 15_000);
  const [tab, setTab] = useState<Tab>("active");
  const [stopping, setStopping] = useState<Set<string>>(new Set());
  const [err, setErr] = useState("");

  const all = ae.data?.campaigns ?? [];
  const ordered = useMemo(
    () => workingOrder(all.filter((c) => c.status === "running" && !stopping.has(c.tweet_id))),
    [all, stopping],
  );
  const active = useMemo(() => ordered.map((o) => o.c), [ordered]);
  const finished = useMemo(
    () => all.filter((c) => c.status !== "running").sort((a, b) => b.started_at - a.started_at).slice(0, 100),
    [all],
  );
  const boosting = active.filter((c) => c.active).length;

  async function stop(c: AeCampaign) {
    setErr("");
    setStopping((prev) => new Set(prev).add(c.tweet_id)); // hide it straight away
    try {
      await api.stopAutoEngagePost(c.url);
      void ae.reload();
    } catch (e) {
      setStopping((prev) => {
        const next = new Set(prev);
        next.delete(c.tweet_id);
        return next;
      });
      setErr(String(e instanceof Error ? e.message : e));
    }
  }


  return (
    <>
      <PageHeader
        title="Posts"
        subtitle="Start a boost, and watch every post against its goal."
        right={<Freshness updatedAt={ae.updatedAt} error={ae.error} />}
      />

      <div className="space-y-5">
        <BoostPost cfg={ae.data?.config ?? null} onAdded={() => void ae.reload()} />

        <Card
          title="Posts"
          subtitle={
            tab === "active" ? (
              <>
                In the order the fleet serves them: posts you added, then the 2 newest of each profile, then the rest oldest first.{" "}
                <span className="text-accent">{boosting}</span> getting views, {active.length - boosting} waiting.
              </>
            ) : (
              "Finished, stopped or deleted posts, most recent first (last 100)."
            )
          }
          action={
            <Segmented<Tab>
              value={tab}
              onChange={setTab}
              options={[
                { id: "active", label: `Running (${active.length})` },
                { id: "finished", label: `Finished (${finished.length})` },
              ]}
            />
          }
        >
          {err && (
            <div className="mb-3">
              <Notice tone="bad">{err}</Notice>
            </div>
          )}
          {ae.loading && !ae.data ? (
            <Skeleton className="h-40" />
          ) : (tab === "active" ? active : finished).length === 0 ? (
            <Empty>
              {tab === "active"
                ? "Nothing running. Paste a post link above, or wait for a watched profile to post."
                : "No finished posts yet."}
            </Empty>
          ) : (
            <>
              <PostListHeader />
              <ul className="divide-y divide-ink-line">
                {tab === "active"
                  ? ordered.map(({ c, tier }, i) => <PostRow key={c.tweet_id} c={c} rank={i + 1} tier={tier} onStop={stop} />)
                  : finished.map((c) => <PostRow key={c.tweet_id} c={c} />)}
              </ul>
            </>
          )}
        </Card>
      </div>
    </>
  );
}
