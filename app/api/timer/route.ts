import { NextResponse, type NextRequest } from "next/server";
import { getCurrentTimer, startTimer, stopTimer } from "@/lib/everhour";
import { everhourErrorResponse, noKeyResponse, resolveKey } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/timer — the current running timer (`running: false` when idle). */
export async function GET(req: NextRequest): Promise<Response> {
  const key = resolveKey(req);
  if (!key) return noKeyResponse();
  try {
    return NextResponse.json(await getCurrentTimer(key, req.signal));
  } catch (e) {
    return everhourErrorResponse(e);
  }
}

/** POST /api/timer { taskId } — start a timer on a task. */
export async function POST(req: NextRequest): Promise<Response> {
  const key = resolveKey(req);
  if (!key) return noKeyResponse();

  let body: { taskId?: unknown };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  if (typeof body.taskId !== "string" || !body.taskId) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    return NextResponse.json(await startTimer(key, body.taskId, req.signal));
  } catch (e) {
    return everhourErrorResponse(e);
  }
}

/** DELETE /api/timer — stop the running timer. */
export async function DELETE(req: NextRequest): Promise<Response> {
  const key = resolveKey(req);
  if (!key) return noKeyResponse();
  try {
    return NextResponse.json(await stopTimer(key, req.signal));
  } catch (e) {
    return everhourErrorResponse(e);
  }
}
