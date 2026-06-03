"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Timer } from "@/lib/everhour";
import {
  readSchedule,
  subscribeSchedule,
  writeSchedule,
  type ScheduledTransition,
  type TaskMeta,
} from "@/lib/storage";
import {
  buildApplyTransition,
  buildBreakTransition,
  dueState,
  reconcileWithTimer,
  remainingMs as remainingMsOf,
  type ReconcileVerdict,
} from "../lib/scheduler";

/** Info passed to `onFire` when a scheduled transition executes. */
export interface FireInfo {
  /** Wall-clock seconds the apply timer actually ran (`createdAt → fire`). */
  readonly actualElapsedSec: number;
  /** True when an apply stop ran against a genuinely-running timer (safe to book). */
  readonly booked: boolean;
  /** How late the fire was past its target (e.g. a backgrounded-tab catch-up). */
  readonly lateMs: number;
}

export interface ScheduledTransitionOptions {
  readonly timer: Timer | null;
  readonly start: (taskId: string) => Promise<void>;
  readonly stop: () => Promise<void>;
  /** A manual mutation in flight — don't stack a scheduled one on top. */
  readonly busy: boolean;
  readonly online: boolean;
  /** Called after a transition fires (resume done / apply stopped). */
  readonly onFire?: (t: ScheduledTransition, info: FireInfo) => void;
  /** Called when a pending transition is dropped without firing (manual/external takeover). */
  readonly onAbort?: (t: ScheduledTransition, verdict: ReconcileVerdict) => void;
}

export interface ScheduledTransitionApi {
  readonly schedule: ScheduledTransition | null;
  readonly pending: boolean;
  readonly remainingMs: number;
  /** Stop the running timer now and schedule a resume after `breakMs`. */
  readonly scheduleBreak: (task: TaskMeta, breakMs: number) => Promise<boolean>;
  /** Start a timer on `task` now and schedule an auto-stop after `applySeconds`. */
  readonly scheduleApply: (task: TaskMeta, applySeconds: number) => Promise<boolean>;
  /** Drop the pending schedule without firing (timer is left as-is). */
  readonly cancel: () => void;
  /** Fire the pending transition immediately ("Hervat nu" / "Stop nu"). */
  readonly fireNow: () => void;
}

/** Clear the persisted schedule only if it is still the one we acted on. */
function clearIfStillOurs(t: ScheduledTransition): void {
  if (readSchedule()?.createdAt === t.createdAt) writeSchedule(null);
}

/**
 * The scheduled-timer-transition engine — the shared backbone of Pauze and
 * Gespaarde minuten.
 *
 * It owns no mutations of its own; it drives the single Everhour timer through
 * the `start`/`stop` it is handed (from {@link useLive}), so the one-timer
 * invariant stays centralized. State lives in `localStorage` (so a reload
 * mid-break survives) and is read reactively via `useSyncExternalStore`. A 1s
 * tick runs only while something is scheduled; a `focus`/`visibilitychange`
 * bump does catch-up so a backgrounded tab fires (late, noted) on return.
 */
export function useScheduledTransition(opts: ScheduledTransitionOptions): ScheduledTransitionApi {
  const { start, stop, busy, online } = opts;
  const schedule = useSyncExternalStore(subscribeSchedule, readSchedule, () => null);

  const [nowMs, setNowMs] = useState(() => Date.now());
  const firingRef = useRef(false);

  // Latest values for use inside the async fire path without re-creating it.
  // Synced in an effect (not during render) so the firing effect doesn't need
  // them as deps and we never write a ref mid-render.
  const timerRef = useRef(opts.timer);
  const onFireRef = useRef(opts.onFire);
  const onAbortRef = useRef(opts.onAbort);
  useEffect(() => {
    timerRef.current = opts.timer;
    onFireRef.current = opts.onFire;
    onAbortRef.current = opts.onAbort;
  });

  // Tick once a second, only while a schedule exists (no idle churn).
  useEffect(() => {
    if (!schedule) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [schedule]);

  // Catch-up: refresh `now` when the tab regains focus / visibility, so a
  // schedule that came due while hidden fires immediately on return.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const bump = () => setNowMs(Date.now());
    window.addEventListener("focus", bump);
    document.addEventListener("visibilitychange", bump);
    return () => {
      window.removeEventListener("focus", bump);
      document.removeEventListener("visibilitychange", bump);
    };
  }, []);

  const fire = useCallback(
    async (t: ScheduledTransition) => {
      if (firingRef.current) return;
      // Bail if this schedule was superseded or cancelled while we were queued
      // (e.g. the user manually acted, or another tab changed the timer).
      if (readSchedule()?.createdAt !== t.createdAt) return;
      firingRef.current = true;
      const at = Date.now();
      const lateMs = Math.max(0, at - t.fireAt);
      try {
        if (t.kind === "start") {
          await start(t.task.id);
          clearIfStillOurs(t);
          onFireRef.current?.(t, { actualElapsedSec: 0, booked: false, lateMs });
        } else {
          // Apply: only stop if OUR task is genuinely the running timer — never
          // stop a different timer the user may have started in the meantime.
          const onOurTask = timerRef.current?.running && timerRef.current.task?.id === t.task.id;
          if (!onOurTask) {
            clearIfStillOurs(t);
            onAbortRef.current?.(t, { action: "resolve", reason: "apply target not running" });
            return;
          }
          await stop();
          clearIfStillOurs(t);
          const elapsed = Math.max(0, Math.round((at - t.createdAt) / 1000));
          onFireRef.current?.(t, { actualElapsedSec: elapsed, booked: true, lateMs });
        }
      } catch {
        // Mutation failed (offline / transient): keep the schedule and retry
        // on the next tick or focus.
      } finally {
        firingRef.current = false;
      }
    },
    [start, stop],
  );

  // The driver: react to time + the live timer. Held entirely while offline.
  useEffect(() => {
    if (!schedule || firingRef.current || !online) return;

    const verdict = reconcileWithTimer(schedule, timerRef.current, nowMs);
    if (verdict.action !== "keep") {
      writeSchedule(null);
      onAbortRef.current?.(schedule, verdict);
      return;
    }

    if (dueState(schedule, nowMs) !== "due" || busy) return;
    void fire(schedule);
  }, [schedule, nowMs, online, busy, fire]);

  const scheduleBreak = useCallback(
    async (task: TaskMeta, breakMs: number): Promise<boolean> => {
      if (readSchedule()) return false; // one pending transition at a time
      await stop(); // stop now; await so the timer settles before we schedule
      writeSchedule(buildBreakTransition(task, breakMs, Date.now()));
      return true;
    },
    [stop],
  );

  const scheduleApply = useCallback(
    async (task: TaskMeta, applySeconds: number): Promise<boolean> => {
      if (readSchedule()) return false;
      await start(task.id); // run the apply timer for real
      writeSchedule(buildApplyTransition(task, applySeconds, Date.now()));
      return true;
    },
    [start],
  );

  const cancel = useCallback(() => {
    writeSchedule(null);
  }, []);

  const fireNow = useCallback(() => {
    const t = readSchedule();
    if (t) void fire(t);
  }, [fire]);

  return {
    schedule,
    pending: schedule !== null,
    remainingMs: remainingMsOf(schedule, nowMs),
    scheduleBreak,
    scheduleApply,
    cancel,
    fireNow,
  };
}
