"use client";

import { api } from "../../lib/api";
import { fmtAge, fmtCount, fmtEta } from "../../lib/format";
import { usePoll } from "../../lib/usePoll";
import { Card, Empty, Freshness, PageHeader, Pill, Skeleton, Stat } from "../../components/ui";
import { RestartFleet } from "../../components/RestartFleet";
import { AccountsList } from "../../components/AccountsList";
import { AccountImport } from "../../components/AccountImport";
import { FollowProfiles } from "../../components/FollowProfiles";

export default function FleetPage() {
  const fleet = usePoll(api.getFleet, 10_000);
  const health = usePoll(api.getHealth, 10_000);
  const accounts = usePoll(api.accounts, 120_000);

  const f = fleet.data;
  const h = health.data;
  const threads = f?.server_threads ?? null;
  const load = f?.server_load ?? null;
  const overloaded = threads != null && load != null && load > threads * 1.5;

  return (
    <>
      <PageHeader
        title="Fleet"
        subtitle="The server, the view workers and the accounts."
        right={<Freshness updatedAt={fleet.updatedAt} error={fleet.error} />}
      />

      <div className="space-y-5">
        <Card title="Server" subtitle={f?.server_name ? `${f.server_name}${threads ? ` · ${threads} threads` : ""}` : undefined}>
          {fleet.loading && !f ? (
            <Skeleton className="h-16" />
          ) : (
            <div className="grid grid-cols-2 gap-x-6 gap-y-6 lg:grid-cols-4">
              <Stat label="Views per minute" tone={f?.views_per_min ? "ok" : "neutral"} value={f?.views_per_min != null ? fmtCount(f.views_per_min) : "—"} />
              <Stat label="Time to finish" value={fmtEta(f?.eta_hours)} sub="at the current speed" />
              <Stat
                label="Server load"
                tone={overloaded ? "warn" : "neutral"}
                value={load != null ? Math.round(load) : "—"}
                sub={threads ? `${threads} threads${overloaded ? " · overloaded, speed is CPU-limited" : ""}` : undefined}
              />
              <Stat
                label="View workers reporting"
                tone={h ? (h.healthy === h.expected ? "ok" : "warn") : "neutral"}
                value={h ? `${h.healthy}/${h.expected}` : "—"}
                sub={h && h.starting > 0 ? `${h.starting} starting` : undefined}
              />
            </div>
          )}

          <div className="mt-6 border-t border-ink-line pt-4">
            <h3 className="text-[11px] uppercase tracking-[0.12em] text-subtle">View workers</h3>
            {!h || h.workers.length === 0 ? (
              <div className="mt-3">
                <Empty>{health.error ? "Can't read worker status right now." : "No worker has reported yet."}</Empty>
              </div>
            ) : (
              <ul className="mt-2 divide-y divide-ink-line/60">
                {h.workers.map((w) => (
                  <li key={w.name} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className="font-mono text-xs">{w.name}</span>
                    <span className="flex flex-wrap items-center gap-3 text-xs text-subtle">
                      <Pill tone={w.state === "healthy" ? "ok" : w.state === "starting" ? "warn" : "bad"}>{w.state}</Pill>
                      <span>last report {w.age_s != null ? `${fmtAge(w.age_s)} ago` : "never"}</span>
                      <span className="tnum font-mono">{w.delivered != null ? `${fmtCount(w.delivered)} views` : "—"}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <RestartFleet />
        <FollowProfiles />
        <AccountsList accounts={accounts.data} loading={accounts.loading} error={accounts.error} />
        <AccountImport onImported={() => void accounts.reload()} />
      </div>
    </>
  );
}
