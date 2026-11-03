"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface Poll<T> {
  /** Last good reading. Kept on screen when a later poll fails, never replaced by zeros. */
  data: T | null;
  /** Set while the most recent poll failed. */
  error: string | null;
  /** True until the first poll finishes (success or failure). */
  loading: boolean;
  /** When the last good reading arrived (ms epoch). */
  updatedAt: number | null;
  reload: () => Promise<void>;
}

/**
 * Poll an async function every `ms`. Requests never stack (a slow backend just waits its
 * turn), polling pauses while the tab is hidden, and a failed poll keeps the last good data
 * so a hiccup is shown as "stale", not as a fleet at zero.
 */
export function usePoll<T>(fn: () => Promise<T>, ms: number): Poll<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const inflight = useRef(false);
  const alive = useRef(true);

  const load = useCallback(async () => {
    if (inflight.current) return;
    inflight.current = true;
    try {
      const d = await fnRef.current();
      if (!alive.current) return;
      setData(d);
      setError(null);
      setUpdatedAt(Date.now());
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      inflight.current = false;
      if (alive.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    void load();
    const t = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      void load();
    }, ms);
    return () => {
      alive.current = false;
      clearInterval(t);
    };
  }, [load, ms]);

  return { data, error, loading, updatedAt, reload: load };
}
