"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { Gauge, Article, Stack, SlidersHorizontal, Globe, Sun, Moon, Lightning, Warning } from "@phosphor-icons/react";
import { api } from "../lib/api";
import { usePoll } from "../lib/usePoll";

const NAV = [
  { href: "/", label: "Overview", icon: Gauge },
  { href: "/posts", label: "Posts", icon: Article },
  { href: "/fleet", label: "Fleet", icon: Stack },
  { href: "/settings", label: "Settings", icon: SlidersHorizontal },
  { href: "/networks", label: "Other networks", icon: Globe },
];

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path.startsWith(href));

function ThemeToggle() {
  const [mode, setMode] = useState<"dark" | "light">("dark");
  useEffect(() => {
    setMode(document.documentElement.dataset.theme === "light" ? "light" : "dark");
  }, []);
  function flip() {
    const next = mode === "dark" ? "light" : "dark";
    setMode(next);
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next;
    try {
      localStorage.setItem("cc-theme", next);
    } catch {
      /* private mode */
    }
  }
  return (
    <button
      type="button"
      onClick={flip}
      aria-label={mode === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      className="rounded-lg border border-ink-line p-2 text-muted transition hover:text-fg"
    >
      {mode === "dark" ? <Sun /> : <Moon />}
    </button>
  );
}

/** The one place that says whether the system is healthy. Pages do not repeat it. */
function HealthBanner() {
  const health = usePoll(api.getHealth, 10_000);
  const h = health.data;
  if (health.error && !h) {
    return (
      <div role="alert" className="mb-5 flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
        <Warning weight="fill" className="mt-0.5 shrink-0" />
        <span>
          Can&rsquo;t reach the backend. The fleet itself may still be running; this page just can&rsquo;t read it. Check
          that the server is up and that BACKEND_URL and BACKEND_TOKEN are set correctly in Vercel.
        </span>
      </div>
    );
  }
  if (!h || h.status === "ok") return null;
  const down = h.status === "down";
  return (
    <div role="alert" className="mb-5 flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
      <Warning weight="fill" className="mt-0.5 shrink-0" />
      <span>
        {down ? "Views are paused" : "Views are slower than normal"}: {h.healthy} of {h.expected} view workers are
        reporting. Use <span className="font-semibold">Fleet &rarr; Restart</span> if it doesn&rsquo;t recover on its own.
      </span>
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  return (
    <div className="min-h-[100dvh] lg:pl-60">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-ink-line bg-ink-900/80 px-4 py-6 backdrop-blur lg:flex">
        <div className="flex items-center gap-2.5 px-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent">
            <Lightning weight="fill" />
          </span>
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight">Cornerstone</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-subtle">control</div>
          </div>
        </div>
        <nav className="mt-8 flex flex-1 flex-col gap-1" aria-label="Main">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(path, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  active ? "bg-accent/10 text-accent" : "text-muted hover:bg-ink-800 hover:text-fg"
                }`}
              >
                <Icon weight={active ? "fill" : "regular"} className="text-lg" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] uppercase tracking-[0.16em] text-subtle">theme</span>
          <ThemeToggle />
        </div>
      </aside>

      <header className="sticky top-0 z-30 border-b border-ink-line bg-ink-900/90 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Lightning weight="fill" className="text-accent" /> Cornerstone
          </div>
          <ThemeToggle />
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2" aria-label="Main">
          {NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(path, href) ? "page" : undefined}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${
                isActive(path, href) ? "bg-accent/10 text-accent" : "text-muted"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <HealthBanner />
        {children}
      </main>
    </div>
  );
}
