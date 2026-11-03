// Typed client for the auto-tt backend. Every request goes to this app's own /api/* proxy
// route (app/api/[...path]/route.ts), which adds the token server-side. The browser never
// sees the backend URL or the token.

export interface Account {
  account: string;
  handle: string;
  has_session: boolean;
  has_avatar?: boolean;
}

// ---- Auto-engage (X) ------------------------------------------------------------------
export interface AeRange {
  views: [number, number];
  likes: [number, number];
  reposts: [number, number];
  comments: [number, number];
}
export interface AeTargetConfig {
  enabled: boolean;
  ranges: AeRange | null;
}
export interface AeConfig {
  enabled: boolean;
  view_threshold: number;
  drip_window_seconds: number;
  poll_interval_seconds: number;
  max_active_per_target: number;
  max_active_total: number;
  boost_max_age_days: number;
  default_ranges: AeRange;
  targets: Record<string, AeTargetConfig>;
}
export interface AeCampaign {
  tweet_id: string;
  target: string;
  url: string;
  status: string; // running | done | stopped | deleted
  manual?: boolean;
  active?: boolean; // true = in the fleet's view set right now; false while running = queued
  started_at: number; // epoch seconds
  view_target: number;
  views_done: number; // the post's PUBLIC view count on X (organic + ours)
  plan: { views: number; likes: number; reposts: number; comments: number };
  done: { like: number; repost: number; comment: number }; // PUBLIC counts on X now
  total_actions: number;
  done_actions: number;
}
export interface AeThroughput {
  views_per_min: number | null;
  eta_hours: number | null;
  remaining_views: number;
}
export interface AeStatus {
  config: AeConfig;
  campaigns: AeCampaign[];
  throughput?: AeThroughput;
}
export type AeConfigPatch = Partial<
  Pick<
    AeConfig,
    | "enabled"
    | "view_threshold"
    | "drip_window_seconds"
    | "poll_interval_seconds"
    | "max_active_per_target"
    | "max_active_total"
    | "boost_max_age_days"
  >
> & {
  default_ranges?: AeRange;
  targets?: Record<string, Partial<AeTargetConfig>>;
  remove_targets?: string[];
};

export interface PostMetric {
  tweet_id: string;
  url: string;
  live: { views: number | null; likes: number | null; replies: number | null; retweets: number | null };
}
export interface BoostResult {
  action?: string;
  dry_run?: boolean;
  total?: number;
  ok?: number;
  failed?: number;
  target?: number;
  current?: number | null;
  error?: string;
}

// ---- Fleet / health -------------------------------------------------------------------
export interface FleetStatus {
  workers: number;
  desired: number;
  remaining: number;
  posts: number;
  views_per_min?: number | null;
  eta_hours?: number | null;
  rate_source?: string | null;
  rate_window_min?: number | null;
  server_name?: string | null;
  server_threads?: number | null;
  server_load?: number | null;
}
export interface WorkerHealth {
  name: string;
  index: number | string;
  state: "healthy" | "down" | "starting";
  age_s: number | null;
  cycle: number | null;
  delivered: number | null;
}
export interface HealthStatus {
  status: "ok" | "degraded" | "down";
  expected: number;
  healthy: number;
  down: number;
  starting: number;
  workers: WorkerHealth[];
}
export type RestartScope = "stuck" | "workers" | "brain" | "all";
export interface RestartResult {
  id: string;
  scope: string;
  ok: boolean;
  restarted: string[];
  failed?: Record<string, string>;
  note?: string;
  error?: string;
  finished_at: number;
}
export interface RestartStatus {
  pending: boolean;
  scope: string | null;
  id: string | null;
  age_s: number;
  stale: boolean;
  last: RestartResult | null;
  scopes: RestartScope[];
}
export interface MetricsResp {
  gran: "day" | "week" | "month";
  by: "account" | "post";
  series: Record<string, { bucket: string; views: number }[]>;
}

// ---- Comments -------------------------------------------------------------------------
export interface CommentStyle {
  name: string;
  prompt: string;
  weight: number;
  default_prompt: string;
  default_weight: number;
  customised: boolean;
}
export interface CommentStyles {
  styles: CommentStyle[];
  source: "operator" | "default";
  path: string;
}
export interface CommentBrief {
  text: string;
  source: "operator" | "default";
  chars: number;
  path: string;
}

// ---- Account import -------------------------------------------------------------------
export interface AccountImportResult {
  ok: boolean;
  reason: string | null;
  dry_run: boolean;
  parsed: number;
  skipped: string[];
  skipped_count: number;
  already_present: string[];
  already_count: number;
  new: string[];
  new_count: number;
  imported_count: number;
  proxy_pool: number;
  added_to_view_pool: number;
}

// ---- Other networks -------------------------------------------------------------------
export interface PlatformAccount {
  account: string;
  handle: string;
  status: string;
  has_session: boolean;
}
export interface PlatformFleet {
  accounts: PlatformAccount[];
  summary: Record<string, number>;
  total: number;
}
export interface IgAeCampaign {
  media_id: string;
  shortcode: string;
  handle: string;
  url: string;
  status: string;
  started_at: number;
  total_actions: number;
  done_actions: number;
}
export interface IgAeStatus {
  campaigns: IgAeCampaign[];
}
export interface VideoTarget {
  url: string;
  vid: string;
  quota: number;
  delivered: number;
  status: string;
  public_views?: number;
}
export interface VideoStatus {
  total: number;
  running: number;
  views_delivered: number;
  views_target: number;
  public_views?: number;
  targets: VideoTarget[];
}

// ---- transport ------------------------------------------------------------------------
const REQUEST_TIMEOUT_MS = 15_000;

async function readError(res: Response, label: string): Promise<Error> {
  let detail = "";
  try {
    const body = await res.json();
    detail = typeof body?.detail === "string" ? body.detail : "";
  } catch {
    /* body was not JSON */
  }
  return new Error(detail ? `${label} -> ${res.status}: ${detail}` : `${label} -> ${res.status}`);
}

async function getJSON<T>(path: string, timeoutMs: number = REQUEST_TIMEOUT_MS): Promise<T> {
  const res = await fetch(path, { cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw await readError(res, `GET ${path}`);
  return res.json() as Promise<T>;
}

async function sendJSON<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw await readError(res, `${method} ${path}`);
  return res.json() as Promise<T>;
}

export const api = {
  // X: accounts (the first call after a backend restart can take ~35s at fleet scale)
  accounts: () => getJSON<Account[]>("/api/accounts", 60_000),

  // X: auto-engage
  getAutoEngage: () => getJSON<AeStatus>("/api/autoengage"),
  setAutoEngageConfig: (patch: AeConfigPatch) => sendJSON<AeStatus>("PUT", "/api/autoengage/config", patch),
  addAutoEngagePost: (url: string, ranges?: AeRange) =>
    sendJSON<AeStatus>("POST", "/api/autoengage/add-post", ranges ? { url, ranges } : { url }),
  stopAutoEngagePost: (url: string) => sendJSON<AeStatus>("POST", "/api/autoengage/stop-post", { url }),
  postMetrics: (urls: string[]) => sendJSON<PostMetric[]>("POST", "/api/post-metrics", { urls }),
  // One-off likes/retweets from N accounts right now (dry_run previews).
  boost: (tweet_url: string, action: "like" | "retweet", count: number, dry_run: boolean) =>
    sendJSON<BoostResult>("POST", "/api/boost", { tweet_url, action, count, dry_run, target: 0 }),

  // Fleet / health
  getFleet: () => getJSON<FleetStatus>("/api/fleet"),
  getHealth: () => getJSON<HealthStatus>("/api/health"),
  getRestartStatus: () => getJSON<RestartStatus>("/api/fleet/restart"),
  requestRestart: (scope: RestartScope) =>
    sendJSON<{ id: string; scope: string }>("POST", "/api/fleet/restart", { scope }),
  getMetrics: (gran: "day" | "week" | "month", by: "account" | "post") =>
    getJSON<MetricsResp>(`/api/metrics?gran=${gran}&by=${by}`),

  // Comments
  getCommentBrief: () => getJSON<CommentBrief>("/api/autoengage/brief"),
  saveCommentBrief: (text: string) => sendJSON<CommentBrief>("PUT", "/api/autoengage/brief", { text }),
  resetCommentBrief: () => sendJSON<CommentBrief>("PUT", "/api/autoengage/brief", { reset: true }),
  getCommentStyles: () => getJSON<CommentStyles>("/api/autoengage/styles"),
  saveCommentStyles: (styles: Record<string, { prompt?: string; weight?: number }>) =>
    sendJSON<CommentStyles>("PUT", "/api/autoengage/styles", { styles }),
  resetCommentStyles: () => sendJSON<CommentStyles>("PUT", "/api/autoengage/styles", { reset: true }),

  // Add accounts (preview with dryRun, then commit)
  importAccounts: (text: string, opts: { dryRun: boolean; addToViewPool: boolean; filename?: string }) =>
    sendJSON<AccountImportResult>("POST", "/api/accounts/import", {
      text,
      filename: opts.filename ?? "",
      dry_run: opts.dryRun,
      add_to_view_pool: opts.addToViewPool,
    }),

  // Other networks
  platformFleet: (slug: "ig" | "yt" | "tiktok") => getJSON<PlatformFleet>(`/api/${slug}/accounts`),
  igAutoEngage: () => getJSON<IgAeStatus>("/api/ig/autoengage"),
  addIgPost: (url: string) => sendJSON<IgAeStatus>("POST", "/api/ig/autoengage/add-post", { url }),
  stopIgPost: (url: string) => sendJSON<IgAeStatus>("POST", "/api/ig/autoengage/stop-post", { url }),
  ytAutoEngage: () => getJSON<VideoStatus>("/api/yt/autoengage"),
  addYtPost: (url: string, quota?: number) =>
    sendJSON<VideoTarget>("POST", "/api/yt/autoengage/add-post", quota ? { url, quota } : { url }),
  stopYtPost: (url: string) => sendJSON<{ stopped: boolean }>("POST", "/api/yt/autoengage/stop-post", { url }),
  ttAutoEngage: () => getJSON<VideoStatus>("/api/tiktok/autoengage"),
  addTtPost: (url: string, quota?: number) =>
    sendJSON<VideoTarget>("POST", "/api/tiktok/autoengage/add-post", quota ? { url, quota } : { url }),
  stopTtPost: (url: string) => sendJSON<{ stopped: boolean }>("POST", "/api/tiktok/autoengage/stop-post", { url }),
};
