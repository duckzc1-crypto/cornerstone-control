"use client";

import { AeRange } from "../lib/api";

const numCls =
  "w-20 rounded-lg border border-ink-line bg-ink-850 px-2 py-1.5 text-center font-mono text-xs text-fg outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/15";

/** The most views a post can be boosted to (the backend caps ranges at the same figure). */
export const MAX_VIEW_TARGET = 1_000_000;

export const MAX_RANGES: AeRange = {
  views: [17000, 17000],
  likes: [95, 110],
  reposts: [20, 40],
  comments: [10, 20],
};

/** A small natural bump. Views here are ADDED on top of the post's current count. */
export const MICRO_RANGES: AeRange = {
  views: [2000, 3000],
  likes: [5, 10],
  reposts: [1, 4],
  comments: [1, 3],
};

const halfPair = (v: [number, number]): [number, number] => [Math.round(v[0] / 2), Math.round(v[1] / 2)];

export function halfOf(r: AeRange): AeRange {
  return { views: halfPair(r.views), likes: halfPair(r.likes), reposts: halfPair(r.reposts), comments: halfPair(r.comments) };
}

const ROWS: { key: keyof AeRange; label: string }[] = [
  { key: "views", label: "Views" },
  { key: "likes", label: "Likes" },
  { key: "reposts", label: "Reposts" },
  { key: "comments", label: "Comments" },
];

/** Editable low/high targets for views, likes, reposts and comments. */
export function RangeFields({ value, onChange }: { value: AeRange; onChange: (r: AeRange) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {ROWS.map(({ key, label }) => {
        const max = key === "views" ? MAX_VIEW_TARGET : undefined;
        const clamp = (n: number) => Math.max(0, max ? Math.min(n, max) : n);
        return (
          <div key={key} className="flex items-center gap-2 text-xs text-muted">
            <span className="w-16">{label}</span>
            <input
              type="number"
              min={0}
              max={max}
              aria-label={`${label} low`}
              className={numCls}
              value={value[key][0]}
              onChange={(e) => onChange({ ...value, [key]: [clamp(Number(e.target.value) || 0), value[key][1]] })}
            />
            <span className="text-faint">to</span>
            <input
              type="number"
              min={0}
              max={max}
              aria-label={`${label} high`}
              className={numCls}
              value={value[key][1]}
              onChange={(e) => onChange({ ...value, [key]: [value[key][0], clamp(Number(e.target.value) || 0)] })}
            />
          </div>
        );
      })}
    </div>
  );
}
