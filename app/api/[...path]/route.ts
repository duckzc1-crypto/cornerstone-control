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

const BACKEND =
  process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
const TOKEN = process.env.BACKEND_TOKEN || "";
// Abort just under maxDuration so a hung backend returns a clean 504 JSON rather
// than the platform killing the function with an opaque error.
const UPSTREAM_TIMEOUT_MS = 55_000;

async function forward(req: NextRequest, path: string[]): Promise<NextResponse> {
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
      headers: { "content-type": res.headers.get("content-type") || "application/json" },
    });
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return NextResponse.json(
      {
        detail: aborted
          ? `backend timed out after ${UPSTREAM_TIMEOUT_MS / 1000}s`
          : `backend unreachable: ${String(e)}`,
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
