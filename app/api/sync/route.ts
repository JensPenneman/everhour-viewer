import { NextResponse, type NextRequest } from "next/server";
import { runSync, SyncRequestSchema } from "@/server/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/sync — minimal capability probe.
 *
 * Used by the client at boot to decide whether the empty state should
 * prompt for a key (no env key on server) or allow direct sync (env key
 * present, dev-mode convenience).
 *
 * Crucially: this **never returns the key itself**.
 */
export function GET() {
  return NextResponse.json({ hasEnvKey: !!process.env.EVERHOUR_API_KEY });
}

/**
 * POST /api/sync — streaming NDJSON sync.
 *
 * Key resolution order:
 *   1. `x-everhour-key` header (browser-supplied, primary path),
 *   2. `EVERHOUR_API_KEY` env var (server-side dev fallback only).
 *
 * Body is validated against {@link SyncRequestSchema}; invalid bodies are
 * rejected with 400 before any Everhour call is made.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const key = req.headers.get("x-everhour-key")?.trim() || process.env.EVERHOUR_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "no_api_key" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const parsed = SyncRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const stream = runSync({ key, request: parsed.data, signal: req.signal });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
