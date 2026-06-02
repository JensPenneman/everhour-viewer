import { NextResponse, type NextRequest } from "next/server";
import { searchTasks } from "@/lib/everhour";
import { everhourErrorResponse, noKeyResponse, resolveKey } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/tasks?q= — task search for the timer picker. Short queries → []. */
export async function GET(req: NextRequest): Promise<Response> {
  const key = resolveKey(req);
  if (!key) return noKeyResponse();

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json([]);

  try {
    return NextResponse.json(await searchTasks(key, q, req.signal));
  } catch (e) {
    return everhourErrorResponse(e);
  }
}
