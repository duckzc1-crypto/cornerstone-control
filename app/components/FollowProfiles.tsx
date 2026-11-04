"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { UserPlus } from "@phosphor-icons/react";
import { api, FollowJob } from "../lib/api";
import { fmtEta } from "../lib/format";
import { usePoll } from "../lib/usePoll";
import { Btn, Card, Notice, Pill, Progress, Segmented, TextInput } from "./ui";

// The backend job waits a random 15-40 s between follows, so about 27.5 s on average.
const SECONDS_PER_FOLLOW = 27.5;
const DAILY_CAP = 8;
const STORE_KEY = "cc-follow-job";

type Pick = "3" | "25" | "100" | "500" | "all";
const PICKS: { id: Pick; label: string }[] = [
  { id: "3", label: "3 (test first)" },
  { id: "25", label: "25" },
  { id: "100", label: "100" },
  { id: "500", label: "500" },
  { id: "all", label: "All eligible" },
];
const countOf = (p: Pick) => (p === "all" ? 10000 : Number(p));

const HANDLE_RE = /^@?([A-Za-z0-9_]{1,15})$/;
const URL_RE = /(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})(?:[/?#]|$)/i;

/** A bare handle or a profile link -> the handle, or null if it is neither. */
export function handleOf(input: string): string | null {
  const s = input.trim();
  const m1 = HANDLE_RE.exec(s);
  if (m1) return m1[1];
  const m2 = URL_RE.exec(s);
  if (m2 && !/\/status\//i.test(s)) return m2[1];
  return null;
}

/** The backend answers {"error":"unknown job"} (HTTP 200) for a job it has forgotten, e.g. after a restart. */
function isJob(x: unknown): x is FollowJob {
  const j = x as Partial<FollowJob> | null;
  return !!j && typeof j.job_id === "string" && Array.isArray(j.results) && typeof j.planned === "number" && typeof j.attempted === "number" && typeof j.profile === "string";
}

function forgetJob(): void {
  try {
    localStorage.removeItem(STORE_KEY);
  } catch {
    /* ignore */
  }
}

function failureSummary(job: FollowJob): string {
  const counts = new Map<string, number>();
  for (const r of job.results) {
    if (r.ok) continue;
    const key = (r.error || "failed").slice(0, 60);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k, n]) => `${n} × ${k}`)
    .join(", ");
}

/**
 * Make fleet accounts follow a profile, slowly and with the backend's built-in limits:
 * at most 8 follows per account per day, a random 15-40 s pause between follows, only
 * healthy accounts, one follow per account per job, and an automatic stop after 5 failures
 * in a row (a sign X is refusing follows, so the fleet is not burned against a block).
 */
export function FollowProfiles() {
  const ae = usePoll(api.getAutoEngage, 120_000);
  const watched = useMemo(
    () => Object.entries(ae.data?.config.targets ?? {}).filter(([, t]) => t.enabled).map(([name]) => name),
    [ae.data],
  );
  const [choice, setChoice] = useState<string>("");
  const [other, setOther] = useState("");
  const [pick, setPick] = useState<Pick>("3");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [err, setErr] = useState("");
  const [eligible, setEligible] = useState<number | null>(null);
  const [job, setJob] = useState<FollowJob | null>(null);

  useEffect(() => {
    if (!choice && watched.length) setChoice(watched[0]);
  }, [watched, choice]);

  const handle = choice === "__other" ? handleOf(other) : choice || null;

  // pick up a job that was running before a page refresh
  useEffect(() => {
    let id: string | null = null;
    try {
      id = localStorage.getItem(STORE_KEY);
    } catch {
      /* private mode */
    }
    if (!id) return;
    api
      .getFollow(id)
      .then((j) => {
        if (isJob(j) && !j.dry_run) setJob(j);
        else if (!isJob(j)) forgetJob();     // the server no longer knows this job
      })
      .catch(() => forgetJob());
  }, []);

  // follow a running job until it finishes
  const jobId = job?.job_id;
  const running = job?.status === "running";
  useEffect(() => {
    if (!jobId || !running) return;
    const t = setInterval(() => {
      api
        .getFollow(jobId)
        .then((j) => {
          if (isJob(j)) setJob(j);
          else {
            setJob(null);                       // the server lost the job (restart): stop polling it
            forgetJob();
          }
        })
        .catch(() => undefined);
    }, 4000);
    return () => clearInterval(t);
  }, [jobId, running]);

  const waitForJob = useCallback(async (id: string): Promise<FollowJob> => {
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const j = await api.getFollow(id);
      if (!isJob(j)) throw new Error("the server no longer has this preview");
      if (j.status !== "running") return j;
    }
    const last = await api.getFollow(id);
    if (!isJob(last)) throw new Error("the server no longer has this preview");
    return last;
  }, []);

  async function preview() {
    if (!handle) return;
    setBusy(true);
    setErr("");
    setEligible(null);
    try {
      const first = await api.startFollow(`https://x.com/${handle}`, countOf("all"), true);
      if (!isJob(first)) throw new Error("the server did not accept the preview");
      const done = first.status === "running" ? await waitForJob(first.job_id) : first;
      if (done.error) setErr(done.error);
      else setEligible(done.planned);
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  }

  async function start() {
    if (!handle) return;
    setBusy(true);
    setErr("");
    setConfirm(false);
    try {
      const j = await api.startFollow(`https://x.com/${handle}`, countOf(pick), false);
      if (!isJob(j)) throw new Error("the server did not start the job");
      setJob(j);
      try {
        localStorage.setItem(STORE_KEY, j.job_id);
      } catch {
        /* ignore */
      }
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  }

  const planned = pick === "all" ? eligible ?? 0 : Math.min(countOf(pick), eligible ?? countOf(pick));
  const hours = (planned * SECONDS_PER_FOLLOW) / 3600;
  const failed = job ? job.results.filter((r) => !r.ok).length : 0;

  return (
    <Card
      title="Make accounts follow a profile"
      subtitle={
        <>
          Accounts that follow a profile before they engage with it look more natural. Following is the riskiest thing the fleet does, so
          this runs slowly: at most {DAILY_CAP} follows per account per day, a random 15-40 second pause between follows, healthy accounts
          only, and it stops by itself after 5 failures in a row.
        </>
      }
      action={<UserPlus className="text-xl text-subtle" />}
    >
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-xs font-medium text-muted">Profile</span>
          <select
            value={choice}
            onChange={(e) => {
              setChoice(e.target.value);
              setEligible(null);
              setConfirm(false);
            }}
            className="mt-1 block rounded-lg border border-ink-line bg-ink-850 px-3 py-2 text-sm text-fg outline-none focus:border-accent/60"
            aria-label="Profile to follow"
          >
            {watched.map((n) => (
              <option key={n} value={n}>
                @{n}
              </option>
            ))}
            <option value="__other">Another profile…</option>
          </select>
        </label>
        {choice === "__other" && (
          <label className="block">
            <span className="text-xs font-medium text-muted">Handle or link</span>
            <TextInput
              value={other}
              onChange={(e) => setOther(e.target.value)}
              placeholder="@handle or https://x.com/handle"
              aria-label="Another profile"
              className="mt-1 block w-64 font-mono"
            />
          </label>
        )}
        <Btn variant="ghost" busy={busy} disabled={!handle} onClick={() => void preview()}>
          Preview (nothing is followed)
        </Btn>
      </div>
      {choice === "__other" && other.trim() && !handle && <p className="mt-2 text-xs text-warn">That is not a profile handle or link.</p>}

      {eligible != null && (
        <p className="mt-3 text-sm text-muted">
          <span className="tnum font-mono text-fg">{eligible.toLocaleString()}</span> accounts could follow @{handle} right now (logged in, under today&rsquo;s limit, and not already counted as following it).
        </p>
      )}

      <div className="mt-5 border-t border-ink-line pt-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium text-muted">How many accounts</span>
          <Segmented<Pick> value={pick} onChange={(p) => { setPick(p); setConfirm(false); }} options={PICKS} />
        </div>
        {pick === "3" && (
          <p className="mt-2 text-xs text-subtle">Start with 3. If all three succeed, following works. If they fail with an error such as 403, stop: X is refusing follows from these accounts.</p>
        )}
        {pick !== "3" && eligible != null && (
          <p className="mt-2 text-xs text-subtle">
            About {fmtEta(hours)} at one follow every ~{Math.round(SECONDS_PER_FOLLOW)} seconds for {planned.toLocaleString()} accounts. You can close this page; it keeps running on the server.
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-3">
          {!confirm ? (
            <Btn disabled={!handle || busy || running} onClick={() => setConfirm(true)}>
              Start following…
            </Btn>
          ) : (
            <>
              <span className="text-sm text-muted">
                Make {pick === "all" ? "every eligible account" : `${pick} accounts`} follow <span className="text-fg">@{handle}</span>, slowly?
              </span>
              <Btn busy={busy} onClick={() => void start()}>
                Yes, start
              </Btn>
              <button type="button" onClick={() => setConfirm(false)} className="px-2 text-xs text-subtle hover:text-fg">
                Cancel
              </button>
            </>
          )}
          {running && <span className="text-xs text-subtle">A follow job is already running. Wait for it to finish before starting another.</span>}
        </div>
      </div>

      {err && (
        <div className="mt-4">
          <Notice tone="bad">{err}</Notice>
        </div>
      )}

      {job && !job.dry_run && (
        <div className="mt-5 rounded-xl border border-ink-line bg-ink-850 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium">
              Following <span className="font-mono">@{job.profile.replace(/^.*x\.com\//, "").replace(/^@/, "")}</span>
            </span>
            <Pill tone={job.halted || job.error ? "bad" : job.status === "done" ? "ok" : "neutral"}>
              {job.halted ? "stopped itself" : job.error ? "error" : job.status === "done" ? "finished" : "running"}
            </Pill>
          </div>
          <div className="mt-3">
            <Progress value={job.attempted} max={Math.max(1, job.planned)} tone={job.halted ? "bad" : "ok"} />
          </div>
          <div className="tnum mt-2 flex flex-wrap gap-x-6 gap-y-1 font-mono text-xs text-muted">
            <span>planned {job.planned.toLocaleString()}</span>
            <span>tried {job.attempted.toLocaleString()}</span>
            {(job.skipped_known ?? 0) > 0 && <span>already followed, skipped {(job.skipped_known ?? 0).toLocaleString()}</span>}
            <span className="text-accent">followed {job.succeeded.toLocaleString()}</span>
            <span className={failed ? "text-danger" : ""}>failed {failed.toLocaleString()}</span>
          </div>
          {job.halted && (
            <div className="mt-3">
              <Notice tone="bad">
                {job.halted}
                {failureSummary(job) && <> ({failureSummary(job)})</>}. Nothing more will be sent. Don&rsquo;t retry until you know why X refused.
              </Notice>
            </div>
          )}
          {job.error && (
            <div className="mt-3">
              <Notice tone="bad">{job.error}</Notice>
            </div>
          )}
          {!job.halted && !job.error && failed > 0 && <p className="mt-2 text-xs text-subtle">Failures so far: {failureSummary(job)}</p>}
          {job.status === "done" && !job.halted && !job.error && (
            <p className="mt-3 text-xs text-subtle">Finished. Each of these accounts follows at most {DAILY_CAP} profiles per day, so run the next profile tomorrow if you need more.</p>
          )}
        </div>
      )}
    </Card>
  );
}
