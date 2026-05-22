import { NextRequest, NextResponse } from "next/server";
import { syncEverhour } from "@/lib/everhour";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const overrideKey = req.headers.get("x-everhour-key");
  const key = overrideKey?.trim() || process.env.EVERHOUR_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "No API key. Set EVERHOUR_API_KEY in .env.local or pass one from the UI." },
      { status: 400 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { weeksBack?: number };
  const weeksBack = Math.min(Math.max(body.weeksBack ?? 78, 1), 260);

  try {
    const payload = await syncEverhour(key, weeksBack);
    return NextResponse.json(payload);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

export async function GET() {
  return NextResponse.json({ hasEnvKey: !!process.env.EVERHOUR_API_KEY });
}
