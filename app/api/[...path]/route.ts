import { NextRequest, NextResponse } from "next/server";

// Server-side proxy. The browser calls same-origin /api/*, and this forwards to
// the real backend with a server-only token. Keeps the backend URL and token
// out of the browser entirely (no NEXT_PUBLIC needed), so the backend can
// reject any request that isn't coming through here.
export const dynamic = "force-dynamic";
// Browser-backed backend endpoints (scrape, views, per-account actions) launch
// Chromium and can take several seconds. Give the function headroom: 60s is the
// ceiling on Vercel Hobby and well within Pro.
export const maxDuration = 60;

// Values pasted into the Vercel form often carry a trailing newline, spaces, or even a copied
// terminal prompt. Keep only the first whitespace-separated word, so a sloppy paste still works.
const firstWord = (v: string | undefined) => (v ?? "").trim().split(/\s+/)[0] ?? "";

function cleanUrl(raw: string): string {
  let u = firstWord(raw).replace(/\/+$/, "").replace(/\/api$/i, "");
  if (u && !/^https?:\/\//i.test(u)) u = `https://${u}`;
  return u;
}

const BACKEND =
  cleanUrl(process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE || "") || "http://127.0.0.1:8000";
// Only characters that are legal in an HTTP header value survive.
const TOKEN = firstWord(process.env.BACKEND_TOKEN).replace(/[^\x21-\x7E]/g, "");

/** Says which setting is malformed, never what it contains. */
function configProblem(): string | null {
  try {
    const u = new URL(BACKEND);
    if (!u.hostname) return "BACKEND_URL has no host name";
  } catch {
    return "BACKEND_URL is not a valid URL (expected https://host, with no path)";
  }
  if (!TOKEN) return "BACKEND_TOKEN is empty";
  return null;
}
// Abort just under maxDuration so a hung backend returns a clean 504 JSON rather
// than the platform killing the function with an opaque error.
const UPSTREAM_TIMEOUT_MS = 55_000;

async function forward(req: NextRequest, path: string[]): Promise<NextResponse> {
  const problem = configProblem();
  if (problem) return NextResponse.json({ detail: `backend is not configured: ${problem}` }, { status: 500 });
  const url = `${BACKEND}/api/${path.join("/")}${req.nextUrl.search}`;
  const headers: Record<string, string> = {};
  const contentType = req.headers.get("content-type");
  if (contentType) headers["content-type"] = contentType;
  if (TOKEN) headers["authorization"] = `Bearer ${TOKEN}`;

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const body = hasBody ? await req.text() : undefined;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: req.method,
      headers,
      body,
      cache: "no-store",
      signal: controller.signal,
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: {
        "content-type": res.headers.get("content-type") || "application/json",
        // lets the page measure ages with the server's clock, not the (possibly wrong) browser clock
        "x-server-time": String(Date.now() / 1000),
      },
    });
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    const cause = e instanceof Error && e.cause instanceof Error ? ` (${e.cause.message.slice(0, 120)})` : "";
    return NextResponse.json(
      {
        detail: aborted
          ? `backend timed out after ${UPSTREAM_TIMEOUT_MS / 1000}s`
          : `backend unreachable: ${String(e)}${cause}`,
      },
      { status: aborted ? 504 : 502 },
    );
  } finally {
    clearTimeout(timer);
  }
}

type Ctx = { params: { path: string[] } };
export const GET = (req: NextRequest, ctx: Ctx) => forward(req, ctx.params.path);
export const POST = (req: NextRequest, ctx: Ctx) => forward(req, ctx.params.path);
export const PUT = (req: NextRequest, ctx: Ctx) => forward(req, ctx.params.path);
export const DELETE = (req: NextRequest, ctx: Ctx) => forward(req, ctx.params.path);
export const PATCH = (req: NextRequest, ctx: Ctx) => forward(req, ctx.params.path);
