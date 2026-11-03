"use client";

import { useEffect, useState } from "react";
import { api, CommentBrief, CommentStyles } from "../lib/api";
import { Btn, Card, Notice, Pill } from "./ui";

const areaCls =
  "w-full rounded-lg border border-ink-line bg-ink-850 px-3 py-2 text-sm text-fg outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/15";

function BriefEditor() {
  const [brief, setBrief] = useState<CommentBrief | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);

  useEffect(() => {
    api
      .getCommentBrief()
      .then((b) => {
        setBrief(b);
        setText(b.text);
      })
      .catch((e) => setMsg({ tone: "bad", text: String(e instanceof Error ? e.message : e) }));
  }, []);

  async function run(fn: () => Promise<CommentBrief>, ok: string) {
    setBusy(true);
    setMsg(null);
    try {
      const b = await fn();
      setBrief(b);
      setText(b.text);
      setMsg({ tone: "ok", text: ok });
    } catch (e) {
      setMsg({ tone: "bad", text: String(e instanceof Error ? e.message : e) });
    } finally {
      setBusy(false);
    }
  }

  const dirty = brief != null && text !== brief.text;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">Comment brief</h3>
        {brief && <Pill tone={brief.source === "operator" ? "ok" : "neutral"}>{brief.source === "operator" ? "your text" : "built-in default"}</Pill>}
      </div>
      <p className="mt-1 max-w-prose text-xs text-subtle">
        What every comment should be about and how it should sound. The fleet writes each comment from this, in one of the styles below.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={7}
        disabled={!brief}
        aria-label="Comment brief"
        className={`${areaCls} mt-3 min-h-[8rem] font-mono text-xs leading-relaxed`}
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Btn busy={busy} disabled={!dirty || !text.trim()} onClick={() => void run(() => api.saveCommentBrief(text), "Saved. New comments use it from the next cycle.")}>
          Save brief
        </Btn>
        <Btn variant="ghost" busy={busy} disabled={!brief || brief.source === "default"} onClick={() => void run(api.resetCommentBrief, "Back to the built-in default.")}>
          Reset to default
        </Btn>
        {brief && <span className="tnum text-xs text-subtle">{text.length.toLocaleString()} characters</span>}
      </div>
      {msg && (
        <div className="mt-3">
          <Notice tone={msg.tone}>{msg.text}</Notice>
        </div>
      )}
    </div>
  );
}

function StylesEditor() {
  const [data, setData] = useState<CommentStyles | null>(null);
  const [draft, setDraft] = useState<Record<string, { prompt: string; weight: number }>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);

  function adopt(d: CommentStyles) {
    setData(d);
    setDraft(Object.fromEntries(d.styles.map((s) => [s.name, { prompt: s.prompt, weight: s.weight }])));
  }

  useEffect(() => {
    api
      .getCommentStyles()
      .then(adopt)
      .catch((e) => setMsg({ tone: "bad", text: String(e instanceof Error ? e.message : e) }));
  }, []);

  const dirty = data != null && data.styles.some((s) => draft[s.name]?.prompt !== s.prompt || draft[s.name]?.weight !== s.weight);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      adopt(await api.saveCommentStyles(draft));
      setMsg({ tone: "ok", text: "Saved." });
    } catch (e) {
      setMsg({ tone: "bad", text: String(e instanceof Error ? e.message : e) });
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setBusy(true);
    setMsg(null);
    try {
      adopt(await api.resetCommentStyles());
      setMsg({ tone: "ok", text: "All styles are back to the defaults." });
    } catch (e) {
      setMsg({ tone: "bad", text: String(e instanceof Error ? e.message : e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h3 className="text-sm font-semibold">Comment styles</h3>
      <p className="mt-1 max-w-prose text-xs text-subtle">
        Each comment picks one style at random. A higher weight makes a style more common; 0 turns it off.
      </p>
      {!data ? (
        <p className="mt-3 text-xs text-subtle">Loading…</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {data.styles.map((s) => (
            <li key={s.name} className="rounded-xl border border-ink-line bg-ink-850 p-3.5">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium capitalize">{s.name}</span>
                {s.customised && <Pill tone="ok">customised</Pill>}
                <label className="ml-auto flex items-center gap-2 text-xs text-muted">
                  weight
                  <input
                    type="number"
                    min={0}
                    value={draft[s.name]?.weight ?? s.weight}
                    onChange={(e) => setDraft((d) => ({ ...d, [s.name]: { prompt: d[s.name]?.prompt ?? s.prompt, weight: Math.max(0, Number(e.target.value) || 0) } }))}
                    className="w-16 rounded-lg border border-ink-line bg-ink-900 px-2 py-1 text-center font-mono text-xs outline-none focus:border-accent/60"
                  />
                </label>
              </div>
              <textarea
                value={draft[s.name]?.prompt ?? s.prompt}
                onChange={(e) => setDraft((d) => ({ ...d, [s.name]: { weight: d[s.name]?.weight ?? s.weight, prompt: e.target.value } }))}
                rows={3}
                aria-label={`${s.name} style prompt`}
                className={`${areaCls} mt-2 font-mono text-xs leading-relaxed`}
              />
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Btn busy={busy} disabled={!dirty} onClick={() => void save()}>
          Save styles
        </Btn>
        <Btn variant="ghost" busy={busy} disabled={!data} onClick={() => void reset()}>
          Reset all to defaults
        </Btn>
      </div>
      {msg && (
        <div className="mt-3">
          <Notice tone={msg.tone}>{msg.text}</Notice>
        </div>
      )}
    </div>
  );
}

export function CommentSettings() {
  return (
    <Card title="Comments" subtitle="How the fleet writes comments. Only accounts with a profile picture comment.">
      <div className="space-y-8">
        <BriefEditor />
        <div className="border-t border-ink-line pt-6">
          <StylesEditor />
        </div>
      </div>
    </Card>
  );
}
