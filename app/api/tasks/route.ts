import { NextResponse, type NextRequest } from "next/server";
import { everhourErrorResponse, invalidRequest, noKeyResponse, resolveKey } from "@/server/http";
import { searchTasksService } from "@/server/services";
import { tasksQuerySchema } from "@/server/validation/live";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/tasks?q= — task search for the timer picker. Short queries → []. */
export async function GET(req: NextRequest): Promise<Response> {
  const key = resolveKey(req);
  if (!key) return noKeyResponse();

  const parsed = tasksQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return invalidRequest();

  try {
    return NextResponse.json(await searchTasksService(key, parsed.data.q, req.signal));
  } catch (e) {
    return everhourErrorResponse(e);
  }
}
