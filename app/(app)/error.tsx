"use client";

import { useEffect } from "react";

/**
 * Shown when something on a page throws. Without this a single bad value blanks the whole app with
 * "Application error: a client-side exception has occurred". Here the menu stays and the page can
 * be retried; stored browser state that may have caused it is cleared first.
 */
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("page error:", error);
    try {
      localStorage.removeItem("cc-follow-job");
    } catch {
      /* private mode */
    }
  }, [error]);

  return (
    <div className="mx-auto max-w-xl rounded-xl border border-ink-line bg-ink-850 p-6">
      <h2 className="text-lg font-semibold">This page hit a problem</h2>
      <p className="mt-2 text-sm text-muted">
        The fleet itself is not affected. Reload the page; if it keeps happening, tell whoever maintains the dashboard
        what you clicked and include this line:
      </p>
      <p className="mt-3 break-words rounded-lg bg-ink-900 p-3 font-mono text-xs text-subtle">{error.message || "unknown error"}</p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-ink-950 hover:opacity-90"
      >
        Try again
      </button>
    </div>
  );
}
