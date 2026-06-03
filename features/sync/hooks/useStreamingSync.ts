"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { WeekRecord } from "@/lib/everhour";
import { fmtDuration } from "@/lib/format";
import { profileKey, timesheetKeys } from "@/lib/query";
import { readNdjsonStream } from "@/lib/streaming/ndjson";
import type { SyncEvent } from "@/lib/sync-protocol";

export type SyncPhase = "idle" | "connecting" | "fetching" | "processing" | "done" | "error";

export interface SyncProgress {
  readonly phase: SyncPhase;
  readonly current: number;
  readonly total: number;
  readonly message: string;
  readonly counts: { readonly new: number; readonly updated: number; readonly skipped: number };
}

export interface StreamingSyncOptions {
  readonly apiKey: string | null;
  readonly knownWeeks: ReadonlyArray<{
    isoWeek: string;
    status: WeekRecord["approval"]["status"];
    schemaVersion?: number;
  }>;
  readonly weeksBack?: number;
  readonly force?: boolean;
  readonly onDone?: (counts: SyncProgress["counts"] & { totalWeeks: number }) => void;
  readonly onError?: (message: string, status?: number) => void;
}

export interface StreamingSyncApi {
  readonly progress: SyncProgress | null;
  readonly active: boolean;
  readonly run: (options: StreamingSyncOptions) => Promise<void>;
  readonly abort: () => void;
}

const INITIAL_PROGRESS: SyncProgress = {
  phase: "connecting",
  current: 0,
  total: 0,
  message: "Verbinden met Everhour…",
  counts: { new: 0, updated: 0, skipped: 0 },
};

/** Merge a streamed week into the cached array by ISO-week key. */
function upsertWeek(
  cur: ReadonlyArray<WeekRecord> | undefined,
  week: WeekRecord,
): ReadonlyArray<WeekRecord> {
  const next = [...(cur ?? [])];
  const idx = next.findIndex((w) => w.week.isoWeek === week.week.isoWeek);
  if (idx >= 0) next[idx] = week;
  else next.push(week);
  return next;
}

/**
 * Drive a streaming sync against `POST /api/sync`, modelled as a mutation.
 *
 * As each NDJSON event arrives the profile and weeks are written **directly**
 * into the query cache via `setQueryData` (the persister then writes them to
 * localStorage, throttled), so there are no `onProfile`/`onWeek` callbacks for
 * the caller to wire — the cache is the single source of truth. The bespoke
 * `progress` object (for the header) stays local state; `onDone`/`onError`
 * remain for toasts. After completion the progress lingers briefly then
 * resets.
 */
export function useStreamingSync(): StreamingSyncApi {
  const client = useQueryClient();
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback((delay = 0) => {
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    if (delay <= 0) {
      setProgress(null);
      return;
    }
    clearTimerRef.current = setTimeout(() => setProgress(null), delay);
  }, []);

  const abort = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    reset();
  }, [reset]);

  // Cancel a pending progress-reset timer if the hook ever unmounts.
  useEffect(() => {
    return () => {
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    };
  }, []);

  const { mutateAsync } = useMutation({
    mutationKey: ["sync", "run"],
    retry: false,
    mutationFn: async (options: StreamingSyncOptions) => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;

      setProgress(INITIAL_PROGRESS);
      const counts = { new: 0, updated: 0, skipped: 0 };

      try {
        const resp = await fetch("/api/sync", {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            ...(options.apiKey ? { "x-everhour-key": options.apiKey } : {}),
          },
          body: JSON.stringify({
            knownWeeks: options.knownWeeks,
            weeksBack: options.weeksBack ?? 78,
            force: !!options.force,
          }),
        });

        if (!resp.ok || !resp.body) {
          let message = `HTTP ${resp.status}`;
          try {
            const j = (await resp.json()) as { error?: string };
            if (j?.error === "no_api_key") message = "Geen API-sleutel ingesteld.";
            else if (j?.error === "invalid_request") message = "Ongeldige aanvraag.";
            else if (j?.error) message = j.error;
          } catch {
            /* ignore */
          }
          throw new Error(message);
        }

        await readNdjsonStream<SyncEvent>(resp.body, (event) => {
          if (event.type === "profile") {
            client.setQueryData(profileKey, event.profile);
            setProgress({
              phase: "fetching",
              current: 0,
              total: 0,
              message: `Hallo ${event.profile.name} — weekoverzicht ophalen…`,
              counts: { ...counts },
            });
            return;
          }
          if (event.type === "plan") {
            counts.skipped = event.toSkip;
            setProgress({
              phase: "processing",
              current: 0,
              total: event.toFetch,
              message:
                event.toFetch === 0
                  ? `Niets nieuw — ${event.toSkip} weken al up-to-date.`
                  : `${event.toFetch} weken te verwerken (${event.toSkip} overgeslagen).`,
              counts: { ...counts },
            });
            return;
          }
          if (event.type === "week") {
            if (event.kind === "new") counts.new++;
            else counts.updated++;
            client.setQueryData<ReadonlyArray<WeekRecord>>(timesheetKeys.weeks(), (cur) =>
              upsertWeek(cur, event.week),
            );
            setProgress({
              phase: "processing",
              current: event.current,
              total: event.total,
              message: `Week ${event.current}/${event.total}: ${event.week.week.isoWeek} (${fmtDuration(event.week.totals.seconds)})`,
              counts: { ...counts },
            });
            return;
          }
          if (event.type === "done") {
            options.onDone?.({ ...counts, totalWeeks: event.counts.totalWeeks });
            setProgress({
              phase: "done",
              current: counts.new + counts.updated,
              total: counts.new + counts.updated,
              message: "Klaar.",
              counts: { ...counts },
            });
            return;
          }
          if (event.type === "error") {
            throw new SyncStreamError(event.message, event.status);
          }
          // skip events are informational; already counted via `plan`.
        });
      } catch (e) {
        if (controller.signal.aborted) {
          reset();
          return;
        }
        const message = e instanceof Error ? e.message : String(e);
        const status = e instanceof SyncStreamError ? e.status : undefined;
        options.onError?.(message, status);
        setProgress({
          phase: "error",
          current: 0,
          total: 0,
          message,
          counts: { ...counts },
        });
      } finally {
        if (controllerRef.current === controller) controllerRef.current = null;
        reset(1500);
      }
    },
  });

  const run = useCallback(
    async (options: StreamingSyncOptions) => {
      await mutateAsync(options);
    },
    [mutateAsync],
  );

  return {
    progress,
    active: progress !== null && progress.phase !== "done" && progress.phase !== "error",
    run,
    abort,
  };
}

class SyncStreamError extends Error {
  override readonly name = "SyncStreamError";
  readonly status: number | undefined;
  constructor(message: string, status: number | undefined) {
    super(message);
    this.status = status;
  }
}
