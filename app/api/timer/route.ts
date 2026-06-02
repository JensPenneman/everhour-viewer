import { NextResponse, type NextRequest } from "next/server";
import { everhourErrorResponse, invalidRequest, noKeyResponse, resolveKey } from "@/server/http";
import { getTimer, startTimerForTask, stopRunningTimer } from "@/server/services";
import { timerStartSchema } from "@/server/validation/live";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/timer — the current running timer (`running: false` when idle). */
export async function GET(req: NextRequest): Promise<Response> {
  const key = resolveKey(req);
  if (!key) return noKeyResponse();
  try {
    return NextResponse.json(await getTimer(key, req.signal));
  } catch (e) {
    return everhourErrorResponse(e);
  }
}

/** POST /api/timer { taskId } — start a timer on a task. */
export async function POST(req: NextRequest): Promise<Response> {
  const key = resolveKey(req);
  if (!key) return noKeyResponse();

  const parsed = timerStartSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalidRequest();

  try {
    return NextResponse.json(await startTimerForTask(key, parsed.data.taskId, req.signal));
  } catch (e) {
    return everhourErrorResponse(e);
  }
}

/** DELETE /api/timer — stop the running timer. */
export async function DELETE(req: NextRequest): Promise<Response> {
  const key = resolveKey(req);
  if (!key) return noKeyResponse();
  try {
    return NextResponse.json(await stopRunningTimer(key, req.signal));
  } catch (e) {
    return everhourErrorResponse(e);
  }
}
