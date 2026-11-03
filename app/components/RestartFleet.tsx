"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowClockwise, Check } from "@phosphor-icons/react";
import { api, RestartScope, RestartStatus } from "../lib/api";
import { fmtAge } from "../lib/format";
import { Btn, Card, Notice, Pill } from "./ui";

const SCOPES: { id: RestartScope; label: string; blurb: string }[] = [
  { id: "stuck", label: "Only stalled views", blurb: "just the view workers that stopped advancing" },
  { id: "workers", label: "All view workers", blurb: "every view worker, one after another" },
  { id: "brain", label: "Post detector", blurb: "the part that finds new posts and writes comments" },
  { id: "all", label: "Everything", blurb: "view workers and the post detector" },
];

const labelOf = (id: string | null | undefined) => SCOPES.find((s) => s.id === id)?.label ?? id ?? "";

/**
 * Restart parts of the fleet. The button only queues a request; a root-side agent on the
 * server performs it, so this web app never holds Docker access. Campaigns live in the
 * runtime folder, not in the containers, so restarted workers pick the same posts back up.
 */
export function RestartFleet() {
  const [st, setSt] = useState<RestartStatus | null>(null);
  const [pick, setPick] = useState<RestartScope | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [unreachable, setUnreachable] = useState(false);
  const inflight = useRef(false);

  const load = useCallback(async () => {
    if (inflight.current) return;
    inflight.current = true;
    try {
      setSt(await api.getRestartStatus());
      setUnreachable(false);
    } catch {
      setUnreachable(true);
    } finally {
      inflight.current = false;
    }
  }, []);

  const pending = st?.pending ?? false;
  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), pending ? 5000 : 30000);
    return () => clearInterval(t);
  }, [load, pending]);

  async function go(scope: RestartScope) {
    setBusy(true);
    setErr("");
    try {
      await api.requestRestart(scope);
      setPick(null);
      await load();
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  }

  const last = st?.last ?? null;

  return (
    <Card
      title="Restart"
      subtitle="The view workers can stall without crashing, and nothing restarts them on its own. A restart picks every post back up where it was; progress is stored on the server."
      action={
        pending ? (
          <Pill tone="ok">
            {labelOf(st?.scope)} restarting · {fmtAge(st?.age_s ?? 0)}
          </Pill>
        ) : last ? (
          <Pill tone={last.ok ? "neutral" : "warn"}>
            last: {labelOf(last.scope)} · {last.ok ? (last.restarted.length ? "restarted" : "nothing needed it") : "failed"}
          </Pill>
        ) : undefined
      }
    >
      <div className="flex flex-wrap gap-2">
        {SCOPES.map((s) => (
          <button
            key={s.id}
            type="button"
            title={s.blurb}
            disabled={busy || pending}
            onClick={() => setPick(pick === s.id ? null : s.id)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-40 ${
              pick === s.id ? "border-accent/50 bg-accent/10 text-accent" : "border-ink-line text-muted hover:text-fg"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {pick && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-ink-line bg-ink-850 px-3.5 py-2.5 text-sm text-muted">
          <span>
            Restart <span className="text-fg">{SCOPES.find((s) => s.id === pick)?.blurb}</span>?
            {pick !== "stuck" && " Speed dips for a minute while they come back."}
          </span>
          <span className="ml-auto flex items-center gap-2">
            <button type="button" onClick={() => setPick(null)} className="px-2 text-xs text-subtle hover:text-fg">
              Cancel
            </button>
            <Btn busy={busy} onClick={() => void go(pick)}>
              {!busy && <Check weight="bold" />} Restart
            </Btn>
          </span>
        </div>
      )}

      {st?.stale && (
        <div className="mt-3">
          <Notice tone="warn">
            Queued {fmtAge(st.age_s)} ago but nothing picked it up, so the restart agent on the server is probably not running.
          </Notice>
        </div>
      )}
      {unreachable && (
        <div className="mt-3">
          <Notice tone="warn">
            Can&rsquo;t reach the backend. If the whole server is down, a restart can&rsquo;t be queued from here; reboot it from the host panel.
          </Notice>
        </div>
      )}
      {err && (
        <div className="mt-3">
          <Notice tone="bad">{err}</Notice>
        </div>
      )}
      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-subtle">
        <ArrowClockwise /> Don&rsquo;t restart just to check numbers: each restart cancels the sweeps in progress.
      </p>
    </Card>
  );
}
