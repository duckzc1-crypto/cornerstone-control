"use client";

import { useState } from "react";
import { ArrowSquareOut, Plus, Prohibit } from "@phosphor-icons/react";
import { api, IgAeCampaign, PlatformFleet, VideoStatus, VideoTarget } from "../../lib/api";
import { ageSince, fmtAge, fmtCount } from "../../lib/format";
import { usePoll } from "../../lib/usePoll";
import { Btn, Card, Empty, Notice, PageHeader, Pill, Progress, Skeleton, TextInput } from "../../components/ui";

const IG_RE = /instagram\.com\/(?:p|reel|reels|tv)\/[A-Za-z0-9_-]+/i;
const YT_RE = /(?:youtube\.com\/(?:watch\?v=|shorts\/|live\/|embed\/)|youtu\.be\/)[A-Za-z0-9_-]{6,}/i;
const TT_RE = /tiktok\.com\/(?:@[A-Za-z0-9._]+\/video\/\d+|t\/[A-Za-z0-9]+)|vm\.tiktok\.com\/[A-Za-z0-9]+/i;

function FleetLine({ fleet, error }: { fleet: PlatformFleet | null; error: string | null }) {
  if (!fleet) return <p className="text-xs text-subtle">{error ? "Account fleet isn't reachable right now." : "Loading accounts…"}</p>;
  const alive = fleet.accounts.filter((a) => a.has_session).length;
  return (
    <p className="text-xs text-subtle">
      <span className="tnum font-mono text-fg">{alive.toLocaleString()}</span> of{" "}
      <span className="tnum font-mono text-fg">{fleet.total.toLocaleString()}</span> accounts have a live session
    </p>
  );
}

function AddForm({
  placeholder,
  valid,
  onAdd,
  extra,
}: {
  placeholder: string;
  valid: (s: string) => boolean;
  onAdd: (url: string) => Promise<void>;
  extra?: React.ReactNode;
}) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ok = valid(url.trim());
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!ok || busy) return;
        setBusy(true);
        setErr("");
        try {
          await onAdd(url.trim());
          setUrl("");
        } catch (ex) {
          setErr(String(ex instanceof Error ? ex.message : ex));
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <TextInput value={url} onChange={(e) => setUrl(e.target.value)} placeholder={placeholder} aria-label="Link" className="flex-1 font-mono" />
        {extra}
        <Btn type="submit" busy={busy} disabled={!ok}>
          <Plus weight="bold" /> Boost
        </Btn>
      </div>
      {url.trim() && !ok && <p className="mt-2 text-xs text-warn">That doesn&rsquo;t look like a valid link for this network.</p>}
      {err && (
        <div className="mt-2">
          <Notice tone="bad">{err}</Notice>
        </div>
      )}
    </form>
  );
}

function StopButton({ onStop }: { onStop: () => Promise<void> }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!confirm) {
    return (
      <button type="button" onClick={() => setConfirm(true)} aria-label="Stop boosting this post" title="Stop boosting" className="rounded-md p-1.5 text-faint transition hover:text-danger">
        <Prohibit weight="bold" />
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      <Btn
        variant="danger"
        busy={busy}
        className="!px-2.5 !py-1 text-xs"
        onClick={async () => {
          setBusy(true);
          try {
            await onStop();
          } finally {
            setBusy(false);
            setConfirm(false);
          }
        }}
      >
        Stop
      </Btn>
      <button type="button" onClick={() => setConfirm(false)} className="px-1.5 text-xs text-subtle hover:text-fg">
        Cancel
      </button>
    </span>
  );
}

function InstagramSection() {
  const fleet = usePoll(() => api.platformFleet("ig"), 60_000);
  const ig = usePoll(api.igAutoEngage, 20_000);
  const running = (ig.data?.campaigns ?? []).filter((c) => c.status === "running");
  const other = (ig.data?.campaigns ?? []).filter((c) => c.status !== "running").slice(0, 5);

  const row = (c: IgAeCampaign, live: boolean) => (
    <li key={c.media_id} className="grid items-center gap-x-4 gap-y-1 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
      <div className="min-w-0">
        <a href={c.url} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1.5 text-sm font-medium hover:text-accent">
          <span className="truncate">@{c.handle}</span>
          <ArrowSquareOut className="shrink-0 text-faint" />
        </a>
        <div className="text-[11px] text-subtle">started {fmtAge(ageSince(c.started_at))} ago</div>
      </div>
      <div>
        <div className="tnum flex justify-between font-mono text-xs text-subtle">
          <span>actions done</span>
          <span>
            {c.done_actions}/{c.total_actions}
          </span>
        </div>
        <div className="mt-1.5">
          <Progress value={c.done_actions} max={c.total_actions} />
        </div>
      </div>
      <div className="flex items-center justify-end gap-2">
        <Pill tone={live ? "ok" : "neutral"}>{c.status}</Pill>
        {live && (
          <StopButton
            onStop={async () => {
              await api.stopIgPost(c.url);
              await ig.reload();
            }}
          />
        )}
      </div>
    </li>
  );

  return (
    <Card title="Instagram" subtitle={<FleetLine fleet={fleet.data} error={fleet.error} />}>
      <AddForm
        placeholder="https://www.instagram.com/p/..."
        valid={(s) => IG_RE.test(s)}
        onAdd={async (url) => {
          await api.addIgPost(url);
          await ig.reload();
        }}
      />
      <div className="mt-4">
        {ig.loading && !ig.data ? (
          <Skeleton className="h-16" />
        ) : running.length === 0 && other.length === 0 ? (
          <Empty>No Instagram posts yet.</Empty>
        ) : (
          <ul className="divide-y divide-ink-line">
            {running.map((c) => row(c, true))}
            {other.map((c) => row(c, false))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function VideoSection({
  title,
  slug,
  load,
  add,
  stop,
  re,
  placeholder,
}: {
  title: string;
  slug: "yt" | "tiktok";
  load: () => Promise<VideoStatus>;
  add: (url: string, quota?: number) => Promise<VideoTarget>;
  stop: (url: string) => Promise<{ stopped: boolean }>;
  re: RegExp;
  placeholder: string;
}) {
  const fleet = usePoll(() => api.platformFleet(slug), 60_000);
  const st = usePoll(load, 20_000);
  const [quota, setQuota] = useState("");
  const targets = st.data?.targets ?? [];

  return (
    <Card title={title} subtitle={<FleetLine fleet={fleet.data} error={fleet.error} />}>
      <AddForm
        placeholder={placeholder}
        valid={(s) => re.test(s)}
        extra={
          <TextInput
            type="number"
            min={1}
            value={quota}
            onChange={(e) => setQuota(e.target.value)}
            placeholder="views (optional)"
            aria-label="View quota (optional)"
            className="w-full font-mono sm:w-40"
          />
        }
        onAdd={async (url) => {
          const q = Number(quota);
          await add(url, q > 0 ? q : undefined);
          await st.reload();
        }}
      />
      <div className="mt-4">
        {st.loading && !st.data ? (
          <Skeleton className="h-16" />
        ) : targets.length === 0 ? (
          <Empty>No {title} videos yet.</Empty>
        ) : (
          <ul className="divide-y divide-ink-line">
            {targets.map((t) => (
              <li key={t.url} className="grid items-center gap-x-4 gap-y-1 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                <a href={t.url} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1.5 text-sm font-medium hover:text-accent">
                  <span className="truncate font-mono text-xs">{t.vid}</span>
                  <ArrowSquareOut className="shrink-0 text-faint" />
                </a>
                <div>
                  <div className="tnum flex justify-between font-mono text-xs text-subtle">
                    <span>delivered / quota</span>
                    <span>
                      {fmtCount(t.delivered)}/{fmtCount(t.quota)}
                    </span>
                  </div>
                  <div className="mt-1.5">
                    <Progress value={t.delivered} max={t.quota} />
                  </div>
                  {t.public_views != null && <div className="mt-1 text-[11px] text-subtle">{fmtCount(t.public_views)} views on the platform (it updates slowly)</div>}
                </div>
                <div className="flex items-center justify-end gap-2">
                  <Pill tone={t.status === "running" ? "ok" : "neutral"}>{t.status}</Pill>
                  {t.status === "running" && (
                    <StopButton
                      onStop={async () => {
                        await stop(t.url);
                        await st.reload();
                      }}
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

export default function NetworksPage() {
  return (
    <>
      <PageHeader title="Other networks" subtitle="Instagram, YouTube and TikTok: paste a link to boost it, and watch progress." />
      <div className="space-y-5">
        <InstagramSection />
        <VideoSection title="YouTube" slug="yt" load={api.ytAutoEngage} add={api.addYtPost} stop={api.stopYtPost} re={YT_RE} placeholder="https://www.youtube.com/watch?v=..." />
        <VideoSection title="TikTok" slug="tiktok" load={api.ttAutoEngage} add={api.addTtPost} stop={api.stopTtPost} re={TT_RE} placeholder="https://www.tiktok.com/@user/video/..." />
      </div>
    </>
  );
}
