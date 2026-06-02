"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { EverhourProfile, WeekRecord } from "@/lib/everhour";
import { readCache, writeCache, clearCache } from "@/lib/storage";

export interface ViewerCacheApi {
  /** True once the initial `localStorage` hydration has completed. */
  readonly hydrated: boolean;
  readonly profile: EverhourProfile | null;
  readonly weeks: ReadonlyArray<WeekRecord>;
  readonly sortedWeeks: ReadonlyArray<WeekRecord>;
  readonly totalHours: number;
  readonly setProfile: (profile: EverhourProfile | null) => void;
  /** Replace the weeks array entirely (with persistence). */
  readonly setWeeks: (weeks: ReadonlyArray<WeekRecord>) => void;
  /** Upsert a single week (with persistence). */
  readonly upsertWeek: (week: WeekRecord) => void;
  /** Upsert in bulk; cheaper than calling {@link upsertWeek} in a loop. */
  readonly upsertWeeks: (weeks: ReadonlyArray<WeekRecord>) => void;
  /** Wipe local state and storage. */
  readonly clear: () => void;
}

/**
 * Owns the cached profile + weeks, hydrating from `localStorage` and
 * writing back on every mutation.
 *
 * The hook intentionally returns a single API object rather than separate
 * tuples so consumers can pull only what they need without re-rendering on
 * unrelated changes (`profile`, `weeks` and `sortedWeeks` are referentially
 * stable when unchanged thanks to `useState` and `useMemo`).
 */
export function useViewerCache(): ViewerCacheApi {
  const [hydrated, setHydrated] = useState(false);
  const [profile, setProfileState] = useState<EverhourProfile | null>(null);
  const [weeks, setWeeksState] = useState<ReadonlyArray<WeekRecord>>([]);

  useEffect(() => {
    // SSR-safe hydration from localStorage on first client render. The
    // intentional double-render — empty → hydrated — is the cost of
    // staying compatible with both static rendering and the React 19
    // hydration model. We accept it; using `useSyncExternalStore` here
    // would require caching mutable cache snapshots to satisfy its
    // referential-stability contract, which is more complexity than this
    // pattern saves.
    const snap = readCache();
    if (snap) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional hydration; see comment above
      setProfileState(snap.profile);
      setWeeksState(snap.weeks);
    }
    setHydrated(true);
  }, []);

  // Persist the whole snapshot whenever either field changes (after the
  // initial hydration). Persisting from one effect — rather than inside each
  // setter — avoids a stale-closure bug where the rapid `upsertWeek` calls
  // of a sync re-persisted a stale `profile` (null), dropping the profile
  // from the cache so it vanished on the next reload.
  useEffect(() => {
    if (!hydrated) return;
    writeCache({ profile, weeks });
  }, [hydrated, profile, weeks]);

  const setProfile = useCallback((next: EverhourProfile | null) => {
    setProfileState(next);
  }, []);

  const setWeeks = useCallback((next: ReadonlyArray<WeekRecord>) => {
    setWeeksState(next);
  }, []);

  const upsertWeek = useCallback((week: WeekRecord) => {
    setWeeksState((cur) => {
      const next = [...cur];
      const idx = next.findIndex((w) => w.week.isoWeek === week.week.isoWeek);
      if (idx >= 0) next[idx] = week;
      else next.push(week);
      return next;
    });
  }, []);

  const upsertWeeks = useCallback((incoming: ReadonlyArray<WeekRecord>) => {
    setWeeksState((cur) => {
      const map = new Map(cur.map((w) => [w.week.isoWeek, w]));
      for (const w of incoming) map.set(w.week.isoWeek, w);
      return [...map.values()];
    });
  }, []);

  const clear = useCallback(() => {
    setProfileState(null);
    setWeeksState([]);
    clearCache();
  }, []);

  const sortedWeeks = useMemo(
    () => [...weeks].sort((a, b) => b.week.from.localeCompare(a.week.from)),
    [weeks],
  );

  const totalHours = useMemo(
    () => weeks.reduce((acc, w) => acc + w.totals.seconds, 0) / 3600,
    [weeks],
  );

  return {
    hydrated,
    profile,
    weeks,
    sortedWeeks,
    totalHours,
    setProfile,
    setWeeks,
    upsertWeek,
    upsertWeeks,
    clear,
  };
}
