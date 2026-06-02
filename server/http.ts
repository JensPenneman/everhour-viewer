import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { EverhourError } from "@/lib/everhour";

/**
 * Shared helpers for the live API route handlers.
 *
 * Key resolution mirrors `/api/sync`: the browser-supplied `x-everhour-key`
 * header is primary, with `EVERHOUR_API_KEY` as a server-side dev fallback.
 * The key is never persisted or echoed back.
 */
export function resolveKey(req: NextRequest): string | null {
  return req.headers.get("x-everhour-key")?.trim() || process.env.EVERHOUR_API_KEY || null;
}

export function noKeyResponse(): NextResponse {
  return NextResponse.json({ error: "no_api_key" }, { status: 400 });
}

/** Map an Everhour failure onto an HTTP response, preserving the upstream status. */
export function everhourErrorResponse(e: unknown): NextResponse {
  if (e instanceof EverhourError) {
    const status = e.status >= 400 && e.status < 600 ? e.status : 502;
    return NextResponse.json({ error: e.message, status: e.status }, { status });
  }
  const message = e instanceof Error ? e.message : String(e);
  return NextResponse.json({ error: message }, { status: 502 });
}
