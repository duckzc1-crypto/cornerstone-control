"use client";

import { useState } from "react";
import { Lightning, CaretDown } from "@phosphor-icons/react";
import { AeConfig, AeRange, api } from "../lib/api";
import { fmtCount, POST_RE } from "../lib/format";
import { Btn, Card, NumberField, Notice, Segmented, TextInput, Toggle } from "./ui";
import { halfOf, MAX_RANGES, MICRO_RANGES, RangeFields } from "./RangeFields";

type Preset = "standard" | "light" | "max" | "micro" | "custom";

const PRESETS: { id: Preset; label: string }[] = [
  { id: "standard", label: "Standard" },
  { id: "light", label: "Light" },
  { id: "max", label: "Max" },
  { id: "micro", label: "Micro bump" },
  { id: "custom", label: "Custom" },
];

const PRESET_HELP: Record<Preset, string> = {
  standard: "Your default targets from Settings.",
  light: "Half of the default targets.",
  max: "The hardest push: 17K views, ~100 likes, 20-40 reposts, 10-20 comments.",
  micro: "A small natural bump added on top of the post's current views: about 2-3K views, a few likes, reposts and comments.",
  custom: "Set your own targets below.",
};

function rangesFor(preset: Preset, cfg: AeConfig, custom: AeRange): AeRange {
  if (preset === "max") return MAX_RANGES;
  if (preset === "light") return halfOf(cfg.default_ranges);
  if (preset === "micro") return MICRO_RANGES;
  if (preset === "custom") return custom;
  return cfg.default_ranges;
}

/** The one place to start boosting a post. Replaces the old sidebar slide-over AND the
 *  "Boost a specific post" panel, which did the same job with different options. */
export function BoostPost({ cfg, onAdded }: { cfg: AeConfig | null; onAdded: () => void }) {
  const [url, setUrl] = useState("");
  const [preset, setPreset] = useState<Preset>("standard");
  const [custom, setCustom] = useState<AeRange | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);

  // one-off likes / retweets
  const [oneAction, setOneAction] = useState<"like" | "retweet">("like");
  const [oneCount, setOneCount] = useState(25);
  const [dry, setDry] = useState(true);
  const [oneBusy, setOneBusy] = useState(false);
  const [oneMsg, setOneMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);

  const valid = POST_RE.test(url.trim());
  const base = cfg ? rangesFor(preset, cfg, custom ?? cfg.default_ranges) : null;
  const overThreshold = cfg && base && preset !== "micro" && base.views[1] > cfg.view_threshold;

  async function add() {
    if (!cfg || !base || !valid || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      let ranges = base;
      if (preset === "micro") {
        // View goals are absolute totals, so add the bump on top of what the post has now.
        try {
          const m = await api.postMetrics([url.trim()]);
          const cur = m?.[0]?.live?.views ?? 0;
          if (cur > 0) ranges = { ...base, views: [cur + base.views[0], cur + base.views[1]] };
        } catch {
          /* could not read the current count: fall back to the raw small target */
        }
      }
      await api.addAutoEngagePost(url.trim(), ranges);
      setMsg({ tone: "ok", text: "Added. It will show up in the list below within about a minute." });
      setUrl("");
      onAdded();
    } catch (e) {
      setMsg({ tone: "bad", text: String(e instanceof Error ? e.message : e).replace(/^Error:\s*/, "") });
    } finally {
      setBusy(false);
    }
  }

  async function sendOnce() {
    if (!valid || oneBusy) return;
    setOneBusy(true);
    setOneMsg(null);
    try {
      const r = await api.boost(url.trim(), oneAction, oneCount, dry);
      const noun = oneAction === "like" ? "likes" : "retweets";
      if (r.error) setOneMsg({ tone: "bad", text: r.error });
      else if (dry) setOneMsg({ tone: "ok", text: `Preview only: would send ${noun} from ${r.total ?? oneCount} accounts. Turn off preview to send.` });
      else setOneMsg({ tone: "ok", text: `Sent ${noun} from ${r.ok ?? 0} of ${r.total ?? oneCount} accounts.` });
    } catch (e) {
      setOneMsg({ tone: "bad", text: String(e instanceof Error ? e.message : e) });
    } finally {
      setOneBusy(false);
    }
  }

  return (
    <Card
      title="Boost a post"
      subtitle="Paste an X post link. The fleet adds views, likes, reposts and comments over the next hours, so it looks organic."
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <TextInput
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setMsg(null);
            setOneMsg(null);
          }}
          placeholder="https://x.com/handle/status/..."
          aria-label="Post link"
          className="flex-1 font-mono"
        />
        <Btn busy={busy} disabled={!valid || !cfg} onClick={add}>
          <Lightning weight="fill" /> Boost
        </Btn>
      </div>
      {url.trim() && !valid && <p className="mt-2 text-xs text-warn">That doesn&rsquo;t look like an X post link (it needs /status/ and a number).</p>}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Segmented value={preset} onChange={setPreset} options={PRESETS} />
        <span className="text-xs text-subtle">{PRESET_HELP[preset]}</span>
      </div>
      {cfg && base && preset !== "custom" && (
        <p className="tnum mt-2 font-mono text-[11px] text-subtle">
          {preset === "micro" ? "+" : ""}
          {fmtCount(base.views[0])}-{fmtCount(base.views[1])} views · {base.likes[0]}-{base.likes[1]} likes · {base.reposts[0]}-{base.reposts[1]} reposts ·{" "}
          {base.comments[0]}-{base.comments[1]} comments
        </p>
      )}
      {preset === "custom" && cfg && (
        <div className="mt-3 rounded-xl border border-ink-line bg-ink-850 p-3.5">
          <RangeFields value={custom ?? cfg.default_ranges} onChange={setCustom} />
        </div>
      )}
      {overThreshold && cfg && base && (
        <div className="mt-3">
          <Notice tone="warn">
            This asks for {fmtCount(base.views[1])} views, but boosting stops once a post passes {fmtCount(cfg.view_threshold)} real
            views. Raise &ldquo;Only boost posts under&rdquo; in Settings to reach it.
          </Notice>
        </div>
      )}
      {msg && (
        <div className="mt-3">
          <Notice tone={msg.tone}>{msg.text}</Notice>
        </div>
      )}

      <details className="group mt-5 border-t border-ink-line pt-4">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-muted hover:text-fg">
          <CaretDown className="transition group-open:rotate-180" /> Send likes or retweets right now (one-off)
        </summary>
        <p className="mt-2 max-w-prose text-xs text-subtle">
          This sends immediately from the number of accounts you choose, instead of dripping over hours. It uses the link above. Preview
          first to see how many accounts it would use.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-4">
          <Segmented
            value={oneAction}
            onChange={setOneAction}
            options={[
              { id: "like", label: "Likes" },
              { id: "retweet", label: "Retweets" },
            ]}
          />
          <NumberField label="Accounts" value={oneCount} min={1} onChange={(n) => setOneCount(Math.max(1, n))} />
          <Toggle on={dry} onChange={setDry} label={dry ? "Preview only" : "Send for real"} />
          <Btn variant={dry ? "ghost" : "primary"} busy={oneBusy} disabled={!valid} onClick={sendOnce}>
            {dry ? "Preview" : "Send now"}
          </Btn>
        </div>
        {oneMsg && (
          <div className="mt-3">
            <Notice tone={oneMsg.tone}>{oneMsg.text}</Notice>
          </div>
        )}
      </details>
    </Card>
  );
}
