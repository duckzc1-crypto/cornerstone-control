"use client";

import { fmtCount } from "../lib/format";

export interface Bar {
  label: string;
  value: number;
}

/** Plain bars, no chart library. Each bar has a title so the exact number shows on hover. */
export function BarChart({ data, height = 132 }: { data: Bar[]; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div>
      <div className="flex items-end gap-1" style={{ height }} role="img" aria-label="Bar chart of views per day">
        {data.map((d) => (
          <div
            key={d.label}
            title={`${d.label}: ${d.value.toLocaleString()} views`}
            className="min-w-0 flex-1 rounded-t bg-accent/70 transition-[height] duration-500 hover:bg-accent"
            style={{ height: `${Math.max(2, (100 * d.value) / max)}%` }}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between font-mono text-[10px] text-subtle">
        <span>{data[0]?.label ?? ""}</span>
        <span>peak {fmtCount(max)}</span>
        <span>{data[data.length - 1]?.label ?? ""}</span>
      </div>
    </div>
  );
}
