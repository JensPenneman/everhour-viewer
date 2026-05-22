import "server-only";

import {
  EverhourError,
  buildWeek,
  fetchProfile,
  fetchTimesheetList,
  fetchWeekEntries,
} from "@/lib/everhour";
import { writeNdjsonLine } from "@/lib/streaming/ndjson";
import type { SyncEvent } from "./events";
import { buildPlan } from "./plan";
import type { SyncRequest } from "./schema";

export interface OrchestratorOptions {
  readonly key: string;
  readonly request: SyncRequest;
  readonly signal?: AbortSignal;
}

/**
 * The full /api/sync server flow, wrapped as a ReadableStream of NDJSON
 * events. The route handler in `app/api/sync/route.ts` is a thin adapter
 * that wires this into a Response — keeping the orchestration testable
 * without spinning up a real HTTP server.
 *
 * Failures *mid-stream* (Everhour rate-limit, network blip) are caught and
 * emitted as a final `error` event rather than thrown — the client treats
 * already-streamed weeks as valid and merges them into its cache.
 */
export function runSync(opts: OrchestratorOptions): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: SyncEvent) => writeNdjsonLine(controller, event);

      try {
        const profile = await fetchProfile(opts.key, opts.signal);
        send({ type: "profile", profile });

        const timesheets = await fetchTimesheetList({
          key: opts.key,
          userId: profile.id,
          weeksBack: opts.request.weeksBack,
          signal: opts.signal,
        });

        const plan = buildPlan(timesheets, opts.request.knownWeeks, opts.request.force);

        send({
          type: "plan",
          total: plan.entries.length,
          toFetch: plan.toFetch.length,
          toSkip: plan.toSkip.length,
        });

        for (const e of plan.toSkip) {
          send({ type: "skip", isoWeek: e.isoWeek });
        }

        const counts = {
          new: 0,
          updated: 0,
          skipped: plan.toSkip.length,
        };

        const knownIsoWeeks = new Set(opts.request.knownWeeks.map((k) => k.isoWeek));

        let current = 0;
        for (const entry of plan.toFetch) {
          current++;
          const rawEntries = await fetchWeekEntries({
            key: opts.key,
            userId: profile.id,
            from: entry.ts.week.from,
            to: entry.ts.week.to,
            signal: opts.signal,
          });
          const week = buildWeek(entry.ts, rawEntries);
          const kind: "new" | "updated" = knownIsoWeeks.has(entry.isoWeek) ? "updated" : "new";
          if (kind === "new") counts.new++;
          else counts.updated++;

          send({
            type: "week",
            week,
            current,
            total: plan.toFetch.length,
            kind,
          });
        }

        send({
          type: "done",
          counts: { ...counts, totalWeeks: plan.entries.length },
        });
      } catch (e) {
        if (e instanceof EverhourError) {
          send({ type: "error", message: e.message, status: e.status });
        } else if (e instanceof Error) {
          send({ type: "error", message: e.message });
        } else {
          send({ type: "error", message: String(e) });
        }
      } finally {
        controller.close();
      }
    },
  });
}
