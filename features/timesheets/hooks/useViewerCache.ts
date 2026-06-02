"use client";

import { useCallback, useMemo } from "react";
import { useIsRestoring, useQuery, useQueryClient } from "@tanstack/react-query";
import type { EverhourProfile, WeekRecord } from "@/lib/everhour";
import { PERSIST_MAX_AGE, profileKey, timesheetKeys } from "@/lib/query";

export interface ViewerCacheApi {
  /** True once the persisted cache has finished restoring. */
  readonly hydrated: boolean;
  readonly profile: EverhourProfile | null;
  readonly weeks: ReadonlyArray<WeekRecord>;
  readonly sortedWeeks: ReadonlyArray<WeekRecord>;
  readonly totalSeconds: number;
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

const EMPTY_WEEKS: ReadonlyArray<WeekRecord> = Object.freeze([]);

/** Merge `week` into `cur` by ISO-week key (replace if present, else append). */
function upsertInto(cur: ReadonlyArray<WeekRecord>, week: WeekRecord): ReadonlyArray<WeekRecord> {
  const next = [...cur];
  const idx = next.findIndex((w) => w.week.isoWeek === week.week.isoWeek);
  if (idx >= 0) next[idx] = week;
  else next.push(week);
  return next;
}

/**
 * Owns the cached profile + weeks, now backed by the persisted TanStack Query
 * cache rather than a hand-rolled localStorage snapshot.
 *
 * Profile and weeks are separate query keys, so a streaming `upsertWeek` can
 * never overwrite the profile — the old single-blob stale-closure bug is
 * impossible by construction. Both keys persist automatically (see the
 * persister); writes go through `setQueryData`. The public `ViewerCacheApi`
 * is unchanged so `Viewer` and friends keep working as-is.
 */
export function useViewerCache(): ViewerCacheApi {
  const client = useQueryClient();
  const isRestoring = useIsRestoring();

  const { data: weeks = EMPTY_WEEKS } = useQuery({
    queryKey: timesheetKeys.weeks(),
    queryFn: () =>
      Promise.resolve(
        client.getQueryData<ReadonlyArray<WeekRecord>>(timesheetKeys.weeks()) ?? EMPTY_WEEKS,
      ),
    staleTime: Infinity,
    gcTime: PERSIST_MAX_AGE,
  });

  const { data: profile = null } = useQuery({
    queryKey: profileKey,
    queryFn: () => Promise.resolve(client.getQueryData<EverhourProfile>(profileKey) ?? null),
    staleTime: Infinity,
    gcTime: PERSIST_MAX_AGE,
  });

  const setProfile = useCallback(
    (next: EverhourProfile | null) => {
      client.setQueryData(profileKey, next);
    },
    [client],
  );

  const setWeeks = useCallback(
    (next: ReadonlyArray<WeekRecord>) => {
      client.setQueryData(timesheetKeys.weeks(), next);
    },
    [client],
  );

  const upsertWeek = useCallback(
    (week: WeekRecord) => {
      client.setQueryData<ReadonlyArray<WeekRecord>>(timesheetKeys.weeks(), (cur) =>
        upsertInto(cur ?? EMPTY_WEEKS, week),
      );
    },
    [client],
  );

  const upsertWeeks = useCallback(
    (incoming: ReadonlyArray<WeekRecord>) => {
      client.setQueryData<ReadonlyArray<WeekRecord>>(timesheetKeys.weeks(), (cur) => {
        const map = new Map((cur ?? EMPTY_WEEKS).map((w) => [w.week.isoWeek, w]));
        for (const w of incoming) map.set(w.week.isoWeek, w);
        return [...map.values()];
      });
    },
    [client],
  );

  const clear = useCallback(() => {
    client.setQueryData(timesheetKeys.weeks(), EMPTY_WEEKS);
    client.setQueryData(profileKey, null);
  }, [client]);

  const sortedWeeks = useMemo(
    () => [...weeks].sort((a, b) => b.week.from.localeCompare(a.week.from)),
    [weeks],
  );

  const totalSeconds = useMemo(() => weeks.reduce((acc, w) => acc + w.totals.seconds, 0), [weeks]);

  return {
    hydrated: !isRestoring,
    profile,
    weeks,
    sortedWeeks,
    totalSeconds,
    setProfile,
    setWeeks,
    upsertWeek,
    upsertWeeks,
    clear,
  };
}
