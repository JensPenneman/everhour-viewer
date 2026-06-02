"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ClockStatus, LiveEntry, Timer } from "@/lib/everhour";
import { parseLocalDate, toLocalIsoDate } from "@/lib/format";

const POLL_MS = 20_000;

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

interface TimerSnapshot {
  readonly timer: Timer;
  /** `Date.now()` when the snapshot was taken, to extrapolate live elapsed. */
  readonly at: number;
}

async function liveFetch<T>(
  path: string,
  apiKey: string | null,
  init?: { method?: string; body?: unknown; signal?: AbortSignal },
): Promise<T> {
  const resp = await fetch(path, {
    method: init?.method ?? "GET",
    headers: {
      ...(apiKey ? { "x-everhour-key": apiKey } : {}),
      ...(init?.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    signal: init?.signal,
  });
  if (!resp.ok) {
    let message = `HTTP ${resp.status}`;
    try {
      const j = (await resp.json()) as { error?: string };
      if (j?.error) message = j.error;
    } catch {
      /* ignore */
    }
    const err = new Error(message) as Error & { status?: number };
    err.status = resp.status;
    throw err;
  }
  return resp.json() as Promise<T>;
}

/** Monday (local) of the ISO week containing `today` (a `YYYY-MM-DD` string). */
function mondayOf(today: string): string {
  const d = parseLocalDate(today);
  const dow = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
  d.setDate(d.getDate() - dow);
  return toLocalIsoDate(d);
}

/**
 * Owns all live state for the Vandaag view: the running timer (polled +
 * ticked locally for a smooth elapsed display), today's attendance clock, and
 * this week-to-date's committed entries. Actions (start/stop/clock) re-read
 * from the server so the running timer, clock, and totals never drift —
 * starting a timer, for instance, also auto-clocks-in upstream.
 */
export function useLive(apiKey: string | null, userId: number | null, today: string): LiveApi {
  const ready = !!apiKey && !!userId;
  const weekStart = useMemo(() => mondayOf(today), [today]);

  const [snapshot, setSnapshot] = useState<TimerSnapshot | null>(null);
  const [clock, setClock] = useState<ClockStatus | null>(null);
  const [entries, setEntries] = useState<ReadonlyArray<LiveEntry>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<LiveAction | null>(null);
  const [clockControlUnavailable, setClockControlUnavailable] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [reloadKey, setReloadKey] = useState(0);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  // Initial load + poll + refresh-on-focus. One effect owns the lifecycle.
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    let cancelled = false;

    const loadTimer = async () => {
      const t = await liveFetch<Timer>("/api/timer", apiKey, { signal: controller.signal });
      if (!cancelled) setSnapshot({ timer: t, at: Date.now() });
    };
    const loadRest = async () => {
      const [c, e] = await Promise.all([
        liveFetch<ClockStatus>(`/api/clock?userId=${userId}&today=${today}`, apiKey, {
          signal: controller.signal,
        }),
        liveFetch<LiveEntry[]>(`/api/time?userId=${userId}&from=${weekStart}&to=${today}`, apiKey, {
          signal: controller.signal,
        }),
      ]);
      if (!cancelled) {
        setClock(c);
        setEntries(e);
      }
    };

    // Intentional setState-on-(re)load — the standard fetch-on-mount/deps
    // pattern, same as the hydration in useViewerCache.
    /* eslint-disable react-hooks/set-state-in-effect */
    setLoading(true);
    setError(null);
    /* eslint-enable react-hooks/set-state-in-effect */
    Promise.all([loadTimer(), loadRest()])
      .catch((err) => {
        if (!cancelled && err?.name !== "AbortError") setError(err?.message ?? "Live data mislukt");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const poll = setInterval(() => {
      void loadTimer().catch(() => undefined);
    }, POLL_MS);
    const onFocus = () => void loadTimer().catch(() => undefined);
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(poll);
      window.removeEventListener("focus", onFocus);
    };
  }, [ready, apiKey, userId, today, weekStart, reloadKey]);

  // 1s tick only while a timer is running, so the elapsed display stays live
  // without churning renders when idle.
  const running = snapshot?.timer.running ?? false;
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  const act = useCallback(async (action: LiveAction, run: () => Promise<void>) => {
    setBusy(action);
    setError(null);
    try {
      await run();
    } catch (err) {
      const e = err as Error & { status?: number };
      if (action === "clock" && e.status && e.status >= 400 && e.status < 500) {
        setClockControlUnavailable(true);
      }
      setError(e?.message ?? "Actie mislukt");
    } finally {
      setBusy(null);
    }
  }, []);

  const start = useCallback(
    (taskId: string) =>
      act("start", async () => {
        const t = await liveFetch<Timer>("/api/timer", apiKey, {
          method: "POST",
          body: { taskId },
        });
        setSnapshot({ timer: t, at: Date.now() });
        refresh(); // committed totals + auto clock-in change after starting
      }),
    [act, apiKey, refresh],
  );

  const stop = useCallback(
    () =>
      act("stop", async () => {
        const t = await liveFetch<Timer>("/api/timer", apiKey, { method: "DELETE" });
        setSnapshot({ timer: t, at: Date.now() });
        refresh(); // the stopped session is now committed
      }),
    [act, apiKey, refresh],
  );

  const clockAction = useCallback(
    (action: "in" | "out") =>
      act("clock", async () => {
        await liveFetch("/api/clock", apiKey, { method: "POST", body: { action } });
        refresh();
      }),
    [act, apiKey, refresh],
  );
  const clockIn = useCallback(() => clockAction("in"), [clockAction]);
  const clockOut = useCallback(() => clockAction("out"), [clockAction]);

  const elapsedSec = useMemo(() => {
    if (!snapshot?.timer.running) return 0;
    return Math.max(0, snapshot.timer.durationSeconds + (nowMs - snapshot.at) / 1000);
  }, [snapshot, nowMs]);

  const todayEntries = useMemo(() => entries.filter((e) => e.date === today), [entries, today]);
  const committedToday = useMemo(
    () => todayEntries.reduce((acc, e) => acc + e.seconds, 0),
    [todayEntries],
  );
  const committedWeek = useMemo(() => entries.reduce((acc, e) => acc + e.seconds, 0), [entries]);

  return {
    ready,
    loading,
    error,
    busy,
    timer: snapshot?.timer ?? null,
    elapsedSec,
    clock,
    clockControlUnavailable,
    todayEntries,
    todaySec: committedToday + elapsedSec,
    weekSec: committedWeek + elapsedSec,
    start,
    stop,
    clockIn,
    clockOut,
    refresh,
  };
}
