"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, TrashSimple } from "@phosphor-icons/react";
import { AeConfig, AeConfigPatch, AeRange, AeTargetConfig, api } from "../../lib/api";
import { Btn, Card, Notice, NumberField, PageHeader, Skeleton, TextInput, Toggle } from "../../components/ui";
import { RangeFields } from "../../components/RangeFields";
import { CommentSettings } from "../../components/CommentSettings";

function ProfileRow({
  name,
  cfg,
  defaults,
  onSave,
  onRemove,
  busy,
}: {
  name: string;
  cfg: AeTargetConfig;
  defaults: AeRange;
  onSave: (patch: Partial<AeTargetConfig>) => void;
  onRemove: () => void;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [draft, setDraft] = useState<AeRange>(cfg.ranges ?? defaults);
  const custom = cfg.ranges != null;

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Toggle on={cfg.enabled} onChange={(v) => onSave({ enabled: v })} />
        <span className="min-w-[8rem] flex-1 font-mono text-sm">@{name}</span>
        <span className="text-xs text-subtle">{cfg.enabled ? (custom ? "custom targets" : "default targets") : "switched off"}</span>
        <Btn variant="ghost" className="!px-2.5 !py-1 text-xs" onClick={() => setOpen((o) => !o)}>
          {open ? "Close" : "Targets"}
        </Btn>
        {confirm ? (
          <span className="inline-flex items-center gap-1.5">
            <Btn variant="danger" className="!px-2.5 !py-1 text-xs" disabled={busy} onClick={onRemove}>
              Remove @{name}
            </Btn>
            <button type="button" className="px-1.5 text-xs text-subtle hover:text-fg" onClick={() => setConfirm(false)}>
              Cancel
            </button>
          </span>
        ) : (
          <button
            type="button"
            aria-label={`Remove @${name}`}
            onClick={() => setConfirm(true)}
            className="rounded-md p-1.5 text-faint transition hover:text-danger"
          >
            <TrashSimple weight="bold" />
          </button>
        )}
      </div>
      {open && (
        <div className="mt-3 space-y-3 rounded-xl border border-ink-line bg-ink-850 p-3.5">
          <RangeFields value={draft} onChange={setDraft} />
          <div className="flex gap-2">
            <Btn
              className="!px-3 !py-1.5 text-xs"
              onClick={() => {
                onSave({ ranges: draft });
                setOpen(false);
              }}
            >
              Use these for @{name}
            </Btn>
            {custom && (
              <Btn
                variant="ghost"
                className="!px-3 !py-1.5 text-xs"
                onClick={() => {
                  onSave({ ranges: null });
                  setOpen(false);
                }}
              >
                Back to default targets
              </Btn>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

export default function SettingsPage() {
  const [saved, setSaved] = useState<AeConfig | null>(null);
  const [cfg, setCfg] = useState<AeConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [newProfile, setNewProfile] = useState("");

  const load = useCallback(async () => {
    try {
      const s = await api.getAutoEngage();
      setSaved(s.config);
      setCfg(s.config);
    } catch (e) {
      setMsg({ tone: "bad", text: `Couldn't load the settings: ${e instanceof Error ? e.message : e}` });
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function save(patch: AeConfigPatch, ok = "Saved. The watcher picks it up on its next cycle.", keepDraft = false) {
    setBusy(true);
    setMsg(null);
    try {
      const s = await api.setAutoEngageConfig(patch);
      setSaved(s.config);
      setCfg((cur) => (keepDraft && cur ? { ...cur, targets: s.config.targets, enabled: s.config.enabled } : s.config));
      setMsg({ tone: "ok", text: ok });
    } catch (e) {
      setMsg({ tone: "bad", text: String(e instanceof Error ? e.message : e) });
    } finally {
      setBusy(false);
    }
  }

  if (!cfg || !saved) {
    return (
      <>
        <PageHeader title="Settings" />
        {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : <Skeleton className="h-64" />}
      </>
    );
  }

  const dirty =
    cfg.view_threshold !== saved.view_threshold ||
    cfg.drip_window_seconds !== saved.drip_window_seconds ||
    cfg.boost_max_age_days !== saved.boost_max_age_days ||
    cfg.max_active_total !== saved.max_active_total ||
    JSON.stringify(cfg.default_ranges) !== JSON.stringify(saved.default_ranges);

  return (
    <>
      <PageHeader title="Settings" subtitle="What gets boosted, how hard, and how comments are written." />

      <div className="space-y-5">
        {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

        <Card
          title="Auto-engage"
          subtitle="Watches your profiles and boosts each new post under the limit: views, likes, reposts and comments, dripped over hours."
          action={
            <Toggle
              on={cfg.enabled}
              onChange={(v) => void save({ enabled: v }, v ? "Auto-engage is on." : "Auto-engage is paused. Running posts keep going.", true)}
              label={cfg.enabled ? "On" : "Paused"}
            />
          }
        >
          <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
            <NumberField
              label="Only boost posts under"
              suffix="views"
              value={cfg.view_threshold}
              step={1000}
              onChange={(n) => setCfg({ ...cfg, view_threshold: n })}
              hint="A post that already has more views than this is never picked up, and a running post stops once it passes it."
            />
            <NumberField
              label="Only posts newer than"
              suffix="days"
              value={cfg.boost_max_age_days}
              step={0.5}
              onChange={(n) => setCfg({ ...cfg, boost_max_age_days: n })}
              hint="Older posts are dropped, even if they haven't reached their goal."
            />
            <NumberField
              label="At most this many posts at once"
              suffix="posts"
              value={cfg.max_active_total}
              min={1}
              onChange={(n) => setCfg({ ...cfg, max_active_total: Math.max(1, n) })}
              hint="More posts at once lets the fleet deliver more views per minute, because an account counts once per post every few hours. Each post then finishes more slowly."
            />
            <NumberField
              label="Spread likes, reposts and comments over"
              suffix="hours"
              value={Math.round((cfg.drip_window_seconds / 3600) * 10) / 10}
              step={0.5}
              onChange={(n) => setCfg({ ...cfg, drip_window_seconds: n * 3600 })}
              hint="How long the engagement for one post is drip-fed."
            />
          </div>

          <div className="mt-6 border-t border-ink-line pt-5">
            <h3 className="text-[11px] uppercase tracking-[0.12em] text-subtle">Default targets per post</h3>
            <p className="mb-3 mt-1 text-xs text-subtle">Each post gets a random value between low and high. Used for every profile without its own targets.</p>
            <RangeFields value={cfg.default_ranges} onChange={(r) => setCfg({ ...cfg, default_ranges: r })} />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Btn
              busy={busy}
              disabled={!dirty}
              onClick={() =>
                void save(
                  {
                    view_threshold: cfg.view_threshold,
                    drip_window_seconds: cfg.drip_window_seconds,
                    boost_max_age_days: cfg.boost_max_age_days,
                    max_active_total: cfg.max_active_total,
                    default_ranges: cfg.default_ranges,
                  },
                  "Saved. The watcher picks it up on its next cycle.",
                )
              }
            >
              Save changes
            </Btn>
            <Btn variant="ghost" disabled={!dirty || busy} onClick={() => setCfg(saved)}>
              Discard
            </Btn>
            {dirty && <span className="text-xs text-warn">You have unsaved changes.</span>}
          </div>
        </Card>

        <Card
          title="Profiles watched"
          subtitle="Every new post from these profiles is boosted. Switch one off to pause it without losing its settings."
          action={<span className="tnum font-mono text-xs text-subtle">{Object.values(cfg.targets).filter((t) => t.enabled).length} of {Object.keys(cfg.targets).length} on</span>}
        >
          <ul className="divide-y divide-ink-line/60">
            {Object.entries(cfg.targets).map(([name, tc]) => (
              <ProfileRow
                key={name}
                name={name}
                cfg={tc}
                defaults={cfg.default_ranges}
                busy={busy}
                onSave={(patch) => void save({ targets: { [name]: patch } }, `Saved @${name}.`, true)}
                onRemove={() => void save({ remove_targets: [name] }, `Removed @${name}.`, true)}
              />
            ))}
          </ul>
          <form
            className="mt-4 flex items-center gap-2 border-t border-ink-line pt-4"
            onSubmit={(e) => {
              e.preventDefault();
              const name = newProfile.trim().replace(/^@+/, "").replace(/\s+/g, "");
              setNewProfile("");
              if (!name || cfg.targets[name]) return;
              void save({ targets: { [name]: { enabled: true } } }, `Now watching @${name}.`, true);
            }}
          >
            <span className="font-mono text-sm text-faint">@</span>
            <TextInput value={newProfile} onChange={(e) => setNewProfile(e.target.value)} placeholder="handle to watch" aria-label="Profile handle to add" className="flex-1 font-mono" />
            <Btn type="submit" disabled={busy || !newProfile.trim()}>
              <Plus weight="bold" /> Add
            </Btn>
          </form>
        </Card>

        <CommentSettings />
      </div>
    </>
  );
}
