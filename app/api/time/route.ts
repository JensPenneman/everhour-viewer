import { NextResponse, type NextRequest } from "next/server";
import { fetchTimeRange } from "@/lib/everhour";
import { everhourErrorResponse, noKeyResponse, resolveKey } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/time?userId=&from=&to= — committed time entries in the range,
 * trimmed for the live day/week totals on the Vandaag view.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const key = resolveKey(req);
  if (!key) return noKeyResponse();

  const params = req.nextUrl.searchParams;
  const userId = Number(params.get("userId"));
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  if (!Number.isFinite(userId) || userId <= 0 || !ISO_DATE.test(from) || !ISO_DATE.test(to)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    return NextResponse.json(await fetchTimeRange(key, userId, from, to, req.signal));
  } catch (e) {
    return everhourErrorResponse(e);
  }
}
