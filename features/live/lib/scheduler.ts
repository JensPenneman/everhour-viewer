import type { Timer } from "@/lib/everhour";
import type { ScheduledTransition, TaskMeta } from "@/lib/storage";

/**
 * Pure decision core for the scheduled-timer-transition engine.
 *
 * Everything timing- or reconciliation-related that can be decided from plain
 * values lives here so it is unit-testable without React, intervals, or a DOM.
 * The hook ({@link useScheduledTransition}) only applies these verdicts.
 */

export type DueState = "none" | "pending" | "due";

/** Whether a schedule has no entry, is still waiting, or is ready to fire. */
export function dueState(t: ScheduledTransition | null, now: number): DueState {
  if (!t) return "none";
  return now >= t.fireAt ? "due" : "pending";
}

/** Milliseconds still left before firing (0 once due / when none). */
export function remainingMs(t: ScheduledTransition | null, now: number): number {
  if (!t) return 0;
  return Math.max(0, t.fireAt - now);
}

/** How late a fire is past its target (0 if not yet due / when none). */
export function latenessMs(t: ScheduledTransition | null, now: number): number {
  if (!t) return 0;
  return Math.max(0, now - t.fireAt);
}

export interface ReconcileVerdict {
  /** `keep`: leave it pending. `cancel`: drop it (user/other took over). `resolve`: it already happened — clear (an apply still books its elapsed). */
  readonly action: "keep" | "cancel" | "resolve";
  readonly reason: string;
}

/**
 * Reconcile a pending transition against the *actual* live timer (e.g. the user
 * manually started/stopped, or another tab/device changed it).
 *
 * A `graceMs` window after creation is treated as `keep` so the brief moment
 * between scheduling and the timer query settling can't self-cancel a fresh
 * schedule.
 */
export function reconcileWithTimer(
  t: ScheduledTransition | null,
  timer: Timer | null,
  now: number,
  graceMs = 5_000,
): ReconcileVerdict {
  if (!t) return { action: "keep", reason: "no schedule" };
  if (now - t.createdAt < graceMs) return { action: "keep", reason: "within grace window" };

  const running = timer?.running ?? false;
  const runningId = timer?.task?.id ?? null;

  if (t.kind === "start") {
    // A break waiting to resume `t.task`.
    if (!running) return { action: "keep", reason: "waiting to resume" };
    if (runningId === t.task.id) return { action: "resolve", reason: "target already running" };
    return { action: "cancel", reason: "another task started manually" };
  }

  // An apply waiting to stop the timer it started on `t.task`.
  if (!running) return { action: "resolve", reason: "timer already stopped" };
  if (runningId === t.task.id) return { action: "keep", reason: "apply timer still running" };
  return { action: "cancel", reason: "a different task is running" };
}

/** Build a break transition: resume `task` after `breakMs`. */
export function buildBreakTransition(
  task: TaskMeta,
  breakMs: number,
  now: number,
): ScheduledTransition {
  return { kind: "start", reason: "break", task, fireAt: now + breakMs, createdAt: now };
}

/** Build an apply transition: stop the apply timer after `applySeconds`. */
export function buildApplyTransition(
  task: TaskMeta,
  applySeconds: number,
  now: number,
): ScheduledTransition {
  return {
    kind: "stop",
    reason: "apply",
    task,
    fireAt: now + Math.max(0, applySeconds) * 1000,
    createdAt: now,
  };
}
