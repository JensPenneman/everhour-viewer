"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { differenceInSeconds, startOfWeek } from "date-fns";
import { errorMessage } from "@/lib/errors";
import type { ClockStatus, LiveEntry, Timer } from "@/lib/everhour";
import { parseLocalDate, toLocalIsoDate } from "@/lib/format";
import { everhourStatusOf, useTRPC } from "@/lib/trpc/client";

const POLL_MS = 20_000;
const EMPTY_ENTRIES: ReadonlyArray<LiveEntry> = Object.freeze([]);

export type LiveAction = "start" | "stop" | "clock";

export interface LiveApi {
  readonly ready: boolean;
  readonly loading: boolean;
  readonly error: string | null;
  /** Action currently in flight, for disabling controls. */
  readonly busy: LiveAction | null;

  readonly timer: Timer | null;
  /** Live elapsed of the running timer in seconds (ticks every second). */
  readonly elapsedSec: number;

  readonly clock: ClockStatus | null;
  /** True once a clock-in/out call has been rejected (endpoint unsupported). */
  readonly clockControlUnavailable: boolean;

  readonly todayEntries: ReadonlyArray<LiveEntry>;
  /** Committed + live-running seconds for today / this week-to-date. */
  readonly todaySec: number;
  readonly weekSec: number;

  readonly start: (taskId: string) => Promise<void>;
  readonly stop: () => Promise<void>;
  readonly clockIn: () => Promise<void>;
  readonly clockOut: () => Promise<void>;
  readonly refresh: () => void;
}

/** Monday (local) of the ISO week containing `today` (a `YYYY-MM-DD` string). */
function mondayOf(today: string): string {
  return toLocalIsoDate(startOfWeek(parseLocalDate(today), { weekStartsOn: 1 }));
}

/**
 * Owns all live state for the Vandaag view: the running timer (polled every
 * 20s + on focus, ticked locally for a smooth elapsed display), today's
 * attendance clock, and this week-to-date's committed entries — all via tRPC
 * (`timer`/`clock`/`time`) on the shared, type-safe query layer. Actions are
 * tRPC mutations with `retry: false` (no double-start) that invalidate the
 * timer/clock/time queries so totals never drift (starting a timer also
 * auto-clocks-in upstream).
 *
 * The API key is attached by the tRPC link, so it's no longer a hook argument.
 */
export function useLive(userId: number | null, today: string, enabled = true): LiveApi {
  const ready = enabled && userId !== null;
  const weekStart = useMemo(() => mondayOf(today), [today]);
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [nowMs, setNowMs] = useState(() => Date.now());
  const [actionError, setActionError] = useState<string | null>(null);
  const [clockControlUnavailable, setClockControlUnavailable] = useState(false);

  const timerQuery = useQuery(
    trpc.timer.current.queryOptions(undefined, {
      enabled: ready,
      refetchInterval: POLL_MS,
      refetchOnWindowFocus: true,
      staleTime: 0,
      gcTime: 60_000,
    }),
  );

  const clockQuery = useQuery(
    trpc.clock.today.queryOptions(
      { userId: userId ?? -1, today },
      { enabled: ready, staleTime: 30_000 },
    ),
  );

  const timeQuery = useQuery(
    trpc.time.range.queryOptions(
      { userId: userId ?? -1, from: weekStart, to: today },
      { enabled: ready, staleTime: 30_000 },
    ),
  );

  const invalidateLive = useCallback(() => {
    void queryClient.invalidateQueries(trpc.timer.pathFilter());
    void queryClient.invalidateQueries(trpc.clock.pathFilter());
    void queryClient.invalidateQueries(trpc.time.pathFilter());
  }, [queryClient, trpc]);

  const startMutation = useMutation(
    trpc.timer.start.mutationOptions({
      onMutate: () => setActionError(null),
      onSuccess: (timer) => {
        queryClient.setQueryData(trpc.timer.current.queryKey(), timer);
        invalidateLive(); // committed totals + auto clock-in change after starting
      },
      onError: (e) => setActionError(errorMessage(e) || "Actie mislukt"),
    }),
  );

  const stopMutation = useMutation(
    trpc.timer.stop.mutationOptions({
      onMutate: () => setActionError(null),
      onSuccess: (timer) => {
        queryClient.setQueryData(trpc.timer.current.queryKey(), timer);
        invalidateLive(); // the stopped session is now committed
      },
      onError: (e) => setActionError(errorMessage(e) || "Actie mislukt"),
    }),
  );

  const clockMutation = useMutation(
    trpc.clock.set.mutationOptions({
      onMutate: () => setActionError(null),
      onSuccess: () => invalidateLive(),
      onError: (e) => {
        const status = everhourStatusOf(e);
        if (status !== null && status >= 400 && status < 500) setClockControlUnavailable(true);
        setActionError(errorMessage(e) || "Actie mislukt");
      },
    }),
  );

  // 1s tick only while a timer is running, so the elapsed display stays live
  // without churning renders when idle.
  const running = timerQuery.data?.running ?? false;
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  const start = useCallback(
    async (taskId: string) => {
      await startMutation.mutateAsync({ taskId }).catch(() => undefined);
    },
    [startMutation],
  );
  const stop = useCallback(async () => {
    await stopMutation.mutateAsync().catch(() => undefined);
  }, [stopMutation]);
  const clockIn = useCallback(async () => {
    await clockMutation.mutateAsync({ action: "in" }).catch(() => undefined);
  }, [clockMutation]);
  const clockOut = useCallback(async () => {
    await clockMutation.mutateAsync({ action: "out" }).catch(() => undefined);
  }, [clockMutation]);

  const timer = timerQuery.data ?? null;
  const elapsedSec = useMemo(() => {
    if (!timer?.running) return 0;
    return Math.max(
      0,
      timer.durationSeconds + differenceInSeconds(nowMs, timerQuery.dataUpdatedAt),
    );
  }, [timer, nowMs, timerQuery.dataUpdatedAt]);

  const entries = timeQuery.data ?? EMPTY_ENTRIES;
  const todayEntries = useMemo(() => entries.filter((e) => e.date === today), [entries, today]);
  const committedToday = useMemo(
    () => todayEntries.reduce((acc, e) => acc + e.seconds, 0),
    [todayEntries],
  );
  const committedWeek = useMemo(() => entries.reduce((acc, e) => acc + e.seconds, 0), [entries]);

  const busy: LiveAction | null = startMutation.isPending
    ? "start"
    : stopMutation.isPending
      ? "stop"
      : clockMutation.isPending
        ? "clock"
        : null;

  const queryError = timerQuery.error ?? clockQuery.error ?? timeQuery.error;
  const error =
    actionError ?? (queryError ? errorMessage(queryError) || "Live data mislukt" : null);

  return {
    ready,
    loading: ready && (timerQuery.isLoading || clockQuery.isLoading || timeQuery.isLoading),
    error,
    busy,
    timer,
    elapsedSec,
    clock: clockQuery.data ?? null,
    clockControlUnavailable,
    todayEntries,
    todaySec: committedToday + elapsedSec,
    weekSec: committedWeek + elapsedSec,
    start,
    stop,
    clockIn,
    clockOut,
    refresh: invalidateLive,
  };
}
