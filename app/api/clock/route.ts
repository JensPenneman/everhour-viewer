import { NextResponse, type NextRequest } from "next/server";
import { clockInOut, getClockToday } from "@/lib/everhour";
import { everhourErrorResponse, noKeyResponse, resolveKey } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/clock?userId=&today= — today's attendance clock status. */
export async function GET(req: NextRequest): Promise<Response> {
  const key = resolveKey(req);
  if (!key) return noKeyResponse();

  const userId = Number(req.nextUrl.searchParams.get("userId"));
  const today = req.nextUrl.searchParams.get("today") ?? new Date().toISOString().slice(0, 10);
  if (!Number.isFinite(userId) || userId <= 0) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    return NextResponse.json(await getClockToday(key, userId, today, req.signal));
  } catch (e) {
    return everhourErrorResponse(e);
  }
}

/** POST /api/clock { action: "in" | "out" } — manual clock in/out (best-effort). */
export async function POST(req: NextRequest): Promise<Response> {
  const key = resolveKey(req);
  if (!key) return noKeyResponse();

  let body: { action?: unknown };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  if (body.action !== "in" && body.action !== "out") {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    await clockInOut(key, body.action, req.signal);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return everhourErrorResponse(e);
  }
}
