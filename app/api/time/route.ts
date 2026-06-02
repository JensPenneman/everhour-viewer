import { NextResponse, type NextRequest } from "next/server";
import { everhourErrorResponse, invalidRequest, noKeyResponse, resolveKey } from "@/server/http";
import { getTimeRange } from "@/server/services";
import { timeQuerySchema } from "@/server/validation/live";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/time?userId=&from=&to= — committed time entries in the range,
 * trimmed for the live day/week totals on the Vandaag view.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const key = resolveKey(req);
  if (!key) return noKeyResponse();

  const parsed = timeQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return invalidRequest();
  const { userId, from, to } = parsed.data;

  try {
    return NextResponse.json(await getTimeRange(key, userId, from, to, req.signal));
  } catch (e) {
    return everhourErrorResponse(e);
  }
}
