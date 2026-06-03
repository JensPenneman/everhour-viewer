"use client";

import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DayEvent, DayEventKind } from "@/lib/events";
import { PROVIDERS } from "@/lib/providers";
import { eventKeys } from "@/lib/query";
import { readManualEvents, writeManualEvents } from "@/lib/storage";

export interface DayEventsApi {
  /** All known events (manual + provider-sourced) within the active range. */
  readonly all: ReadonlyArray<DayEvent>;
  /** Quick lookup of every event on a given date. */
  readonly forDate: (isoDate: string) => ReadonlyArray<DayEvent>;
  /** Add a manual event for the given date. */
  readonly addManual: (
    date: string,
    kind: DayEventKind,
    options?: { label?: string; description?: string; hours?: number },
  ) => DayEvent;
  /** Remove a manual event by id. No-op if the event isn't manual. */
  readonly removeManual: (id: string) => void;
  /** Replace the label of a manual event. */
  readonly renameManual: (id: string, label: string) => void;
  /** Refocus the provider window. Idempotent; cheap to call. */
  readonly setRange: (from: string, to: string) => void;
  /** Notify the hook that a provider's state changed and a re-fetch is required. */
  readonly refreshProviders: () => void;
}

const EMPTY: ReadonlyArray<DayEvent> = Object.freeze([]);
const PROVIDERS_KEY = [...eventKeys.all, "providers"] as const;

/**
 * Owns the day-event overlay state, backed by TanStack Query.
 *
 * Manual events are a localStorage-backed query (writes go through a mutation;
 * cross-tab + same-tab refresh via the storage→invalidation bridge — see
 * `writeManualEvents`, which dispatches a synthetic `storage` event). Provider
 * events (holidays, ICS) are a query keyed on the active range. `forDate` is a
 * callback over a memoised map, since the day-detail render does several
 * lookups per week.
 */
export function useDayEvents(): DayEventsApi {
  const client = useQueryClient();

  const { data: manual = EMPTY } = useQuery({
    queryKey: eventKeys.manual(),
    queryFn: () => readManualEvents(),
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const [range, setRangeState] = useState<{ from: string; to: string } | null>(null);

  const { data: providerEvents = EMPTY } = useQuery({
    queryKey: range ? eventKeys.providers(range.from, range.to) : eventKeys.providers("", ""),
    queryFn: async ({ signal }) => {
      if (!range) return EMPTY;
      const results = await Promise.all(
        PROVIDERS.map(async (p) => {
          if (!p.status().ready) return [] as ReadonlyArray<DayEvent>;
          try {
            return await p.fetchEvents({ from: range.from, to: range.to, signal });
          } catch (e) {
            console.error(`[providers] ${p.meta.id} failed:`, e);
            return [] as ReadonlyArray<DayEvent>;
          }
        }),
      );
      return results.flat();
    },
    enabled: !!range,
    staleTime: 5 * 60_000,
  });

  const { mutate: writeManual } = useMutation({
    mutationFn: (events: ReadonlyArray<DayEvent>) => {
      // writeManualEvents returns false on a localStorage failure (quota /
      // disabled); reject so the write isn't reported as a success.
      if (!writeManualEvents(events)) {
        return Promise.reject(new Error("Kon dag-events niet opslaan."));
      }
      return Promise.resolve(events);
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: eventKeys.manual() });
    },
    onError: (e) => {
      console.error("[day-events] write failed:", e);
    },
  });

  const setRange = useCallback((from: string, to: string) => {
    setRangeState((cur) => (cur && cur.from === from && cur.to === to ? cur : { from, to }));
  }, []);

  const refreshProviders = useCallback(() => {
    void client.invalidateQueries({ queryKey: PROVIDERS_KEY });
  }, [client]);

  const all = useMemo<ReadonlyArray<DayEvent>>(
    () => [...providerEvents, ...manual],
    [providerEvents, manual],
  );

  const byDate = useMemo<ReadonlyMap<string, ReadonlyArray<DayEvent>>>(() => {
    const m = new Map<string, DayEvent[]>();
    for (const ev of all) {
      const arr = m.get(ev.date) ?? [];
      arr.push(ev);
      m.set(ev.date, arr);
    }
    return m;
  }, [all]);

  const forDate = useCallback(
    (isoDate: string): ReadonlyArray<DayEvent> => byDate.get(isoDate) ?? EMPTY,
    [byDate],
  );

  const addManual = useCallback<DayEventsApi["addManual"]>(
    (date, kind, opts) => {
      const next: DayEvent = {
        id: `manual:${date}:${kind}:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        date,
        kind,
        source: "manual",
        label: opts?.label ?? defaultManualLabel(kind),
        ...(opts?.description !== undefined ? { description: opts.description } : {}),
        ...(opts?.hours !== undefined ? { hours: opts.hours } : {}),
      };
      writeManual([...readManualEvents(), next]);
      return next;
    },
    [writeManual],
  );

  const removeManual = useCallback(
    (id: string) => {
      writeManual(readManualEvents().filter((e) => e.id !== id));
    },
    [writeManual],
  );

  const renameManual = useCallback(
    (id: string, label: string) => {
      writeManual(readManualEvents().map((e) => (e.id === id ? { ...e, label } : e)));
    },
    [writeManual],
  );

  return {
    all,
    forDate,
    addManual,
    removeManual,
    renameManual,
    setRange,
    refreshProviders,
  };
}

function defaultManualLabel(kind: DayEventKind): string {
  switch (kind) {
    case "holiday":
      return "Feestdag";
    case "leave":
      return "Verlof";
    case "sick":
      return "Ziek";
    case "office_closed":
      return "Kantoor gesloten";
    case "other":
      return "Anders";
  }
}
