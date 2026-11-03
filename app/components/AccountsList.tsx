"use client";

import { useMemo, useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { Account } from "../lib/api";
import { Btn, Card, Empty, Pill, Skeleton, Stat, TextInput } from "./ui";

const PAGE = 100;

/** Accounts at a glance: how many are alive, and a searchable list. Only session state is
 *  shown, because that is the part the backend reports for certain. */
export function AccountsList({
  accounts,
  loading,
  error,
}: {
  accounts: Account[] | null;
  loading: boolean;
  error: string | null;
}) {
  const [q, setQ] = useState("");
  const [only, setOnly] = useState<"all" | "dead">("all");
  const [shown, setShown] = useState(PAGE);

  const stats = useMemo(() => {
    const a = accounts ?? [];
    const live = a.filter((x) => x.has_session).length;
    return { total: a.length, live, dead: a.length - live, avatar: a.filter((x) => x.has_avatar).length };
  }, [accounts]);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase().replace(/^@/, "");
    return (accounts ?? []).filter((a) => {
      if (only === "dead" && a.has_session) return false;
      if (!n) return true;
      return a.account.toLowerCase().includes(n) || (a.handle ?? "").toLowerCase().includes(n);
    });
  }, [accounts, q, only]);

  return (
    <Card title="Accounts" subtitle="Whether each account's login session is still alive. A dead session is skipped by the workers until it is replaced.">
      {loading && !accounts ? (
        <Skeleton className="h-32" />
      ) : error && !accounts ? (
        <Empty>Couldn&rsquo;t load the account list ({error}). It can take up to a minute right after the backend restarts.</Empty>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            <Stat label="Accounts" value={stats.total.toLocaleString()} />
            <Stat label="Session alive" tone="ok" value={stats.live.toLocaleString()} />
            <Stat label="Session dead" tone={stats.dead > 0 ? "warn" : "neutral"} value={stats.dead.toLocaleString()} />
            <Stat label="With a profile picture" value={stats.avatar.toLocaleString()} sub="used for comments" />
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[14rem] flex-1">
              <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
              <TextInput
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setShown(PAGE);
                }}
                placeholder="Search by handle"
                aria-label="Search accounts"
                className="w-full pl-9 font-mono"
              />
            </div>
            <Btn variant={only === "dead" ? "primary" : "ghost"} onClick={() => setOnly(only === "dead" ? "all" : "dead")}>
              Dead sessions only
            </Btn>
          </div>

          {filtered.length === 0 ? (
            <div className="mt-4">
              <Empty>No accounts match.</Empty>
            </div>
          ) : (
            <>
              <ul className="mt-4 grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.slice(0, shown).map((a) => (
                  <li key={a.account} className="flex items-center justify-between gap-2 border-b border-ink-line/60 py-2">
                    <span className="truncate font-mono text-xs">@{a.handle || a.account}</span>
                    <Pill tone={a.has_session ? "ok" : "bad"}>{a.has_session ? "alive" : "dead"}</Pill>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex items-center justify-between text-xs text-subtle">
                <span>
                  showing {Math.min(shown, filtered.length).toLocaleString()} of {filtered.length.toLocaleString()}
                </span>
                {shown < filtered.length && (
                  <Btn variant="ghost" onClick={() => setShown((s) => s + PAGE)}>
                    Show more
                  </Btn>
                )}
              </div>
            </>
          )}
        </>
      )}
    </Card>
  );
}
