"use client";

import { useRef, useState } from "react";
import { FileText, UploadSimple, X } from "@phosphor-icons/react";
import { AccountImportResult, api } from "../lib/api";
import { Btn, Card, Notice, Toggle } from "./ui";

// Order files are plain text, one account per line. A 1000-account batch is ~250KB.
const MAX_BYTES = 4_000_000;

type Phase = "idle" | "reading" | "preview" | "importing" | "done";

function Count({ label, value, tone }: { label: string; value: number; tone?: "accent" | "muted" }) {
  return (
    <div className="rounded-xl border border-ink-line bg-ink-850 px-3.5 py-2.5">
      <div className={`tnum font-mono text-lg ${tone === "accent" ? "text-accent" : tone === "muted" ? "text-subtle" : "text-fg"}`}>
        {value.toLocaleString()}
      </div>
      <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-subtle">{label}</div>
    </div>
  );
}

export function AccountImport({ onImported }: { onImported: () => void }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [filename, setFilename] = useState("");
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<AccountImportResult | null>(null);
  const [result, setResult] = useState<AccountImportResult | null>(null);
  const [error, setError] = useState("");
  const [addToViewPool, setAddToViewPool] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setPhase("idle");
    setFilename("");
    setText("");
    setPreview(null);
    setResult(null);
    setError("");
  }

  async function handleFile(file: File) {
    setError("");
    setResult(null);
    if (file.size > MAX_BYTES) {
      setError(`${file.name} is ${(file.size / 1e6).toFixed(1)} MB, which is too large for an order file.`);
      return;
    }
    setPhase("reading");
    setFilename(file.name);
    try {
      const body = await file.text();
      setText(body);
      // Preview straight away so you see what an import would do before anything is written.
      setPreview(await api.importAccounts(body, { dryRun: true, addToViewPool, filename: file.name }));
      setPhase("preview");
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
      setPhase("idle");
    }
  }

  async function commit() {
    setPhase("importing");
    setError("");
    try {
      setResult(await api.importAccounts(text, { dryRun: false, addToViewPool, filename }));
      setPhase("done");
      onImported();
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
      setPhase("preview");
    }
  }

  const busy = phase === "reading" || phase === "importing";
  const canImport = phase === "preview" && !!preview?.ok && (preview?.new_count ?? 0) > 0;

  return (
    <Card
      title="Add accounts"
      subtitle="Choose a seller order .txt file. Each new account gets a proxy and its own browser fingerprint. Accounts already in the pool are left alone."
      action={
        phase !== "idle" ? (
          <button type="button" onClick={reset} disabled={busy} aria-label="Clear the selected file" className="rounded-lg p-1.5 text-subtle hover:text-fg disabled:opacity-40">
            <X weight="bold" />
          </button>
        ) : undefined
      }
    >
      {phase === "idle" && (
        <>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex w-full flex-col items-center rounded-xl border border-dashed border-ink-line px-6 py-8 text-center transition hover:border-accent/40"
          >
            <FileText weight="light" className="mb-2 text-2xl text-subtle" />
            <span className="text-sm text-muted">
              Choose your order file <span className="text-accent">(browse)</span>
            </span>
            <span className="mt-1 font-mono text-[11px] text-faint">username:password:email:ct0:auth_token</span>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".txt,text/plain"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
              e.target.value = "";
            }}
          />
        </>
      )}

      {phase !== "idle" && (
        <div className="flex items-center gap-2 rounded-xl border border-ink-line bg-ink-850 px-3.5 py-2.5">
          <FileText weight="bold" className="shrink-0 text-subtle" />
          <span className="truncate font-mono text-xs text-muted">{filename}</span>
          {busy && <span className="ml-auto text-xs text-subtle">working…</span>}
        </div>
      )}

      {preview && (phase === "preview" || phase === "importing") && (
        <div className="mt-4">
          {!preview.ok ? (
            <Notice tone="bad">{preview.reason}</Notice>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <Count label="Read" value={preview.parsed} />
                <Count label="Will add" value={preview.new_count} tone="accent" />
                <Count label="Already there" value={preview.already_count} tone="muted" />
                <Count label="Unreadable" value={preview.skipped_count} tone="muted" />
              </div>
              {preview.new_count === 0 && (
                <p className="mt-3 text-xs text-subtle">
                  {preview.parsed > 0
                    ? "Every account in this file is already in the pool, so there is nothing to add."
                    : "No accounts could be read from this file. Check that it is the order .txt."}
                </p>
              )}
              {preview.skipped_count > 0 && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-subtle hover:text-fg">
                    {preview.skipped_count} line{preview.skipped_count === 1 ? "" : "s"} couldn&rsquo;t be read
                  </summary>
                  <ul className="mt-2 space-y-1">
                    {preview.skipped.map((s, i) => (
                      <li key={i} className="truncate font-mono text-[11px] text-faint">
                        {s}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              {preview.new_count > 0 && (
                <div className="mt-4 space-y-4">
                  <div>
                    <Toggle on={addToViewPool} onChange={setAddToViewPool} label="Put the new accounts on view duty" />
                    <p className="mt-1 pl-11 text-xs text-subtle">Fresh accounts earn far more credited views than worn ones. Takes effect when the workers next restart.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Btn busy={phase === "importing"} disabled={!canImport} onClick={() => void commit()}>
                      {phase !== "importing" && <UploadSimple weight="bold" />} Add {preview.new_count.toLocaleString()} account
                      {preview.new_count === 1 ? "" : "s"}
                    </Btn>
                    <span className="text-xs text-subtle">spread across {preview.proxy_pool.toLocaleString()} proxies</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {result && phase === "done" && (
        <div className="mt-4">
          <Notice tone="ok">
            Added {result.imported_count.toLocaleString()} account{result.imported_count === 1 ? "" : "s"}.
            {result.added_to_view_pool > 0 && ` ${result.added_to_view_pool.toLocaleString()} joined view duty (live after the next worker restart).`}
            {result.already_count > 0 && ` ${result.already_count.toLocaleString()} already existed and were left untouched.`}
          </Notice>
        </div>
      )}
      {error && (
        <div className="mt-4">
          <Notice tone="bad">
            <span className="break-all">{error}</span>
          </Notice>
        </div>
      )}
    </Card>
  );
}
