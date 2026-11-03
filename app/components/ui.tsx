"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";
import { CircleNotch, Warning, CheckCircle, Info } from "@phosphor-icons/react";
import { fmtAge } from "../lib/format";

export type Tone = "ok" | "warn" | "bad" | "neutral";

const TONE_TEXT: Record<Tone, string> = {
  ok: "text-accent",
  warn: "text-warn",
  bad: "text-danger",
  neutral: "text-muted",
};
const TONE_BOX: Record<Tone, string> = {
  ok: "border-accent/30 bg-accent/10 text-accent",
  warn: "border-warn/30 bg-warn/10 text-warn",
  bad: "border-danger/30 bg-danger/10 text-danger",
  neutral: "border-ink-line bg-ink-850 text-muted",
};

export function Card({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-ink-line bg-ink-900/60 ${className}`}>
      {(title || action) && (
        <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold tracking-tight">{title}</h2>}
            {subtitle && <div className="mt-0.5 max-w-prose text-xs leading-relaxed text-subtle">{subtitle}</div>}
          </div>
          {action}
        </header>
      )}
      <div className={`px-5 pb-5 ${title || action ? "pt-4" : "pt-5"}`}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-subtle">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

/** A number with a label. `value` is rendered in the mono tabular face. */
export function Stat({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: Tone;
}) {
  return (
    <div>
      <div className={`tnum font-mono text-3xl font-semibold leading-none ${tone === "neutral" ? "text-fg" : TONE_TEXT[tone]}`}>
        {value}
      </div>
      <div className="mt-2 text-[11px] uppercase tracking-[0.12em] text-subtle">{label}</div>
      {sub && <div className="mt-1 text-xs text-subtle">{sub}</div>}
    </div>
  );
}

export function Pill({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${TONE_BOX[tone]}`}>
      {children}
    </span>
  );
}

export function Notice({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  const Icon = tone === "bad" || tone === "warn" ? Warning : tone === "ok" ? CheckCircle : Info;
  return (
    <div className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm ${TONE_BOX[tone]}`}>
      <Icon weight="fill" className="mt-0.5 shrink-0" />
      <div className="min-w-0 leading-relaxed">{children}</div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-ink-line px-4 py-8 text-center text-sm text-subtle">{children}</p>
  );
}

export function Progress({ value, max, tone = "ok" }: { value: number; max: number; tone?: Tone }) {
  const pct = Math.max(0, Math.min(100, Math.round((100 * value) / Math.max(1, max))));
  const bar = tone === "ok" ? "bg-accent" : tone === "warn" ? "bg-warn" : tone === "bad" ? "bg-danger" : "bg-muted";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-800" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full ${bar} transition-[width] duration-500`} style={{ width: `${pct}%` }} />
    </div>
  );
}

type BtnVariant = "primary" | "ghost" | "danger";

export function Btn({
  variant = "primary",
  busy = false,
  className = "",
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; busy?: boolean }) {
  const styles: Record<BtnVariant, string> = {
    primary: "bg-accent text-ink-950 hover:bg-accent-dim",
    ghost: "border border-ink-line text-muted hover:border-accent/40 hover:text-fg",
    danger: "bg-danger/15 text-danger hover:bg-danger/25",
  };
  return (
    <button
      type="button"
      disabled={disabled || busy}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40 ${styles[variant]} ${className}`}
      {...rest}
    >
      {busy && <CircleNotch className="animate-spin" />}
      {children}
    </button>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="inline-flex items-center gap-2 text-sm text-muted"
    >
      <span className={`relative h-5 w-9 shrink-0 rounded-full transition ${on ? "bg-accent" : "bg-ink-700"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-fg transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
      </span>
      {label}
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: string }[];
}) {
  return (
    <div className="inline-flex flex-wrap items-center gap-0.5 rounded-xl border border-ink-line bg-ink-850 p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
            value === o.id ? "bg-accent text-ink-950" : "text-muted hover:text-fg"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const inputCls =
  "rounded-lg border border-ink-line bg-ink-850 px-3 py-2 text-sm text-fg outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/15";

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className ?? ""}`} />;
}

export function NumberField({
  label,
  value,
  onChange,
  suffix,
  min = 0,
  step,
  hint,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  suffix?: string;
  min?: number;
  step?: number;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted">{label}</span>
      <span className="mt-1 flex items-center gap-2">
        <input
          type="number"
          min={min}
          step={step}
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className={`${inputCls} w-28 font-mono`}
        />
        {suffix && <span className="text-xs text-subtle">{suffix}</span>}
      </span>
      {hint && <span className="mt-1 block text-[11px] leading-snug text-subtle">{hint}</span>}
    </label>
  );
}

/** "Updated 12s ago", or a warning that the numbers are stale. */
export function Freshness({ updatedAt, error }: { updatedAt: number | null; error: string | null }) {
  if (error && updatedAt) {
    return (
      <Pill tone="warn">
        <Warning weight="fill" /> backend not answering, showing data from {fmtAge((Date.now() - updatedAt) / 1000)} ago
      </Pill>
    );
  }
  if (error) {
    return (
      <Pill tone="bad">
        <Warning weight="fill" /> can&rsquo;t reach the backend
      </Pill>
    );
  }
  if (!updatedAt) return <Pill>loading</Pill>;
  return <Pill tone="ok">live</Pill>;
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-ink-800 ${className}`} />;
}
