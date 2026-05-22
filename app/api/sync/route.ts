import { NextRequest, NextResponse } from "next/server";
import {
  EverhourError,
  buildWeek,
  fetchProfile,
  fetchTimesheetList,
  fetchWeekEntries,
  isoWeekLabel,
  type ApprovalStatus,
  type WeekRecord,
} from "@/lib/everhour";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type KnownWeek = { isoWeek: string; status: ApprovalStatus };

type RequestBody = {
  knownWeeks?: KnownWeek[];
  weeksBack?: number;
  force?: boolean;
};

type SyncEvent =
  | { type: "profile"; profile: Awaited<ReturnType<typeof fetchProfile>> }
  | { type: "plan"; total: number; toFetch: number; toSkip: number }
  | { type: "week"; week: WeekRecord; current: number; total: number; kind: "new" | "updated" }
  | { type: "skip"; isoWeek: string }
  | { type: "done"; counts: { new: number; updated: number; skipped: number; totalWeeks: number } }
  | { type: "error"; message: string; status?: number };

function resolveKey(req: NextRequest): string | null {
  const fromHeader = req.headers.get("x-everhour-key")?.trim();
  if (fromHeader) return fromHeader;
  return process.env.EVERHOUR_API_KEY ?? null;
}

export async function GET() {
  return NextResponse.json({ hasEnvKey: !!process.env.EVERHOUR_API_KEY });
}

export async function POST(req: NextRequest) {
  const key = resolveKey(req);
  if (!key) {
    return NextResponse.json({ error: "no_api_key" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as RequestBody;
  const weeksBack = Math.min(Math.max(body.weeksBack ?? 78, 1), 260);
  const force = !!body.force;
  const known = new Map<string, ApprovalStatus>(
    (body.knownWeeks ?? []).map((k) => [k.isoWeek, k.status]),
  );

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: SyncEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));

      try {
        const profile = await fetchProfile(key);
        send({ type: "profile", profile });

        const list = await fetchTimesheetList(key, profile.id, weeksBack);

        const planned = list.map((ts) => {
          const iso = isoWeekLabel(ts.week.from);
          const knownStatus = known.get(iso);
          const isSubmitted = !!ts.approval;
          const skip = !force && knownStatus && isSubmitted && knownStatus === ts.approval?.status;
          return { ts, iso, skip: !!skip };
        });

        const toFetch = planned.filter((p) => !p.skip);
        const toSkip = planned.length - toFetch.length;
        send({ type: "plan", total: planned.length, toFetch: toFetch.length, toSkip });

        let counts = { new: 0, updated: 0, skipped: toSkip };
        for (const p of planned) {
          if (p.skip) {
            send({ type: "skip", isoWeek: p.iso });
            continue;
          }
        }

        let i = 0;
        for (const p of toFetch) {
          i++;
          const entries = await fetchWeekEntries(key, profile.id, p.ts.week.from, p.ts.week.to);
          const week = buildWeek(p.ts, entries);
          const kind: "new" | "updated" = known.has(p.iso) ? "updated" : "new";
          counts = {
            ...counts,
            new: counts.new + (kind === "new" ? 1 : 0),
            updated: counts.updated + (kind === "updated" ? 1 : 0),
          };
          send({ type: "week", week, current: i, total: toFetch.length, kind });
        }

        send({ type: "done", counts: { ...counts, totalWeeks: planned.length } });
      } catch (e) {
        if (e instanceof EverhourError) {
          send({ type: "error", message: e.message, status: e.status });
        } else {
          send({ type: "error", message: e instanceof Error ? e.message : String(e) });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
