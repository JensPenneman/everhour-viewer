import { NextResponse, type NextRequest } from "next/server";
import { everhourErrorResponse, invalidRequest, noKeyResponse, resolveKey } from "@/server/http";
import { clock, getClock } from "@/server/services";
import { clockActionSchema, clockQuerySchema } from "@/server/validation/live";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/clock?userId=&today= — today's attendance clock status. */
export async function GET(req: NextRequest): Promise<Response> {
  const key = resolveKey(req);
  if (!key) return noKeyResponse();

  const parsed = clockQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return invalidRequest();
  const today = parsed.data.today ?? new Date().toISOString().slice(0, 10);

  try {
    return NextResponse.json(await getClock(key, parsed.data.userId, today, req.signal));
  } catch (e) {
    return everhourErrorResponse(e);
  }
}

/** POST /api/clock { action: "in" | "out" } — manual clock in/out (best-effort). */
export async function POST(req: NextRequest): Promise<Response> {
  const key = resolveKey(req);
  if (!key) return noKeyResponse();

  const parsed = clockActionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalidRequest();

  try {
    await clock(key, parsed.data.action, req.signal);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return everhourErrorResponse(e);
  }
}
