"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { DayEvent, DayEventKind } from "@/lib/events";
import { PROVIDERS } from "@/lib/providers";
import { readManualEvents, STORAGE_KEYS, writeManualEvents } from "@/lib/storage";

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
  /**
   * Notify the hook that a provider's underlying state has changed
   * (e.g. an .ics file was just imported) and a re-fetch is required.
   */
  readonly refreshProviders: () => void;
}

/**
 * Owns the day-event overlay state.
 *
 * Manual events live in `localStorage`; they're read through
 * `useSyncExternalStore` so the value is computed at render time
 * (no setState-in-effect) and stays in sync across tabs for free via
 * the native `storage` event. Provider events are pulled on demand
 * from the configured {@link PROVIDERS} registry.
 *
 * The hook exposes a `forDate` callback rather than a pre-built map
 * because the day-detail render path needs a handful of lookups per
 * week — building a map per render would dominate the cost.
 */
export function useDayEvents(): DayEventsApi {
  const manual = useSyncExternalStore(
    subscribeToStorage,
    getManualSnapshot,
    getServerManualSnapshot,
  );

  const [providerEvents, setProviderEvents] = useState<ReadonlyArray<DayEvent>>([]);
  const [range, setRangeState] = useState<{ from: string; to: string } | null>(null);
  const [providerRefresh, setProviderRefresh] = useState(0);

  useEffect(() => {
    if (!range) return;
    let cancelled = false;
    const controller = new AbortController();

    void (async () => {
      const results = await Promise.all(
        PROVIDERS.map(async (p) => {
          if (!p.status().ready) return [] as ReadonlyArray<DayEvent>;
          try {
            return await p.fetchEvents({
              from: range.from,
              to: range.to,
              signal: controller.signal,
            });
          } catch (e) {
            console.error(`[providers] ${p.meta.id} failed:`, e);
            return [] as ReadonlyArray<DayEvent>;
          }
        }),
      );
      if (!cancelled) setProviderEvents(results.flat());
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [range, providerRefresh]);

  const setRange = useCallback((from: string, to: string) => {
    setRangeState((cur) => {
      if (cur && cur.from === from && cur.to === to) return cur;
      return { from, to };
    });
  }, []);

  const refreshProviders = useCallback(() => {
    setProviderRefresh((n) => n + 1);
  }, []);

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
    (isoDate: string): ReadonlyArray<DayEvent> => byDate.get(isoDate) ?? [],
    [byDate],
  );

  const addManual = useCallback<DayEventsApi["addManual"]>((date, kind, opts) => {
    const next: DayEvent = {
      id: `manual:${date}:${kind}:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      date,
      kind,
      source: "manual",
      label: opts?.label ?? defaultManualLabel(kind),
      ...(opts?.description !== undefined ? { description: opts.description } : {}),
      ...(opts?.hours !== undefined ? { hours: opts.hours } : {}),
    };
    writeManualEvents([...readManualEvents(), next]);
    return next;
  }, []);

  const removeManual = useCallback((id: string) => {
    writeManualEvents(readManualEvents().filter((e) => e.id !== id));
  }, []);

  const renameManual = useCallback((id: string, label: string) => {
    writeManualEvents(readManualEvents().map((e) => (e.id === id ? { ...e, label } : e)));
  }, []);

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

/* ────────────────────────────────────────────────────────────────────── */
/* useSyncExternalStore plumbing for manual events.                       */
/*                                                                        */
/* Cache the parsed snapshot under a version counter so that repeated     */
/* `getSnapshot` calls between mutations return a stable reference. (the  */
/* hook re-invokes getSnapshot on every render — returning a fresh array  */
/* each time would trip React's tearing detection and loop forever.)     */
/* ────────────────────────────────────────────────────────────────────── */

let cachedManual: ReadonlyArray<DayEvent> | null = null;

function subscribeToStorage(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const handler = (e: StorageEvent) => {
    if (e.key === null || e.key === STORAGE_KEYS.dayEvents) {
      cachedManual = null; // invalidate so the next getSnapshot re-reads
      onChange();
    }
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

function getManualSnapshot(): ReadonlyArray<DayEvent> {
  if (cachedManual !== null) return cachedManual;
  cachedManual = readManualEvents();
  return cachedManual;
}

function getServerManualSnapshot(): ReadonlyArray<DayEvent> {
  return EMPTY_SSR;
}
const EMPTY_SSR: ReadonlyArray<DayEvent> = Object.freeze([]);

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
