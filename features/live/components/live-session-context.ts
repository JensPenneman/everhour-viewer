"use client";

import { createContext, useContext } from "react";
import type { ClockStatus, LiveEntry, Timer } from "@/lib/everhour";
import type { DayLedger, LedgerEntry, ScheduledTransition, TaskMeta } from "@/lib/storage";
import type { LiveAction } from "../hooks";

/**
 * The shared live session — timer state, the scheduled-transition engine, the
 * saved-minutes ledger, and alerts — owned once by {@link LiveSessionProvider}
 * at the shell level so the running timer (and the break/apply countdowns) are
 * visible and keep ticking on every route, with a single engine that can't
 * double-fire a schedule. The Vandaag view and the shell's compact timer both
 * read this instead of instantiating their own.
 */
export interface LiveSessionApi {
  readonly today: string;
  readonly online: boolean;

  // ── Live timer ────────────────────────────────────────────────────────────
  readonly ready: boolean;
  readonly loading: boolean;
  readonly error: string | null;
  readonly busy: LiveAction | null;
  readonly timer: Timer | null;
  readonly elapsedSec: number;
  readonly clock: ClockStatus | null;
  readonly clockControlUnavailable: boolean;
  readonly todayEntries: ReadonlyArray<LiveEntry>;
  /** Tracked seconds (committed + running), before the ledger correction. */
  readonly todaySec: number;
  readonly weekSec: number;
  /** Tracked seconds plus the saved-minutes ledger net (what the meters show). */
  readonly correctedTodaySec: number;
  readonly correctedWeekSec: number;
  /** The ledger's signed contribution (seconds) folded into the totals above. */
  readonly todayCorrectionSec: number;
  readonly weekCorrectionSec: number;
  readonly stop: () => void;
  readonly clockIn: () => void;
  readonly clockOut: () => void;
  /** Manual start: primes audio, cancels any pending break, then starts. */
  readonly startManual: (taskId: string) => void;

  // ── Scheduled-transition engine ─────────────────────────────────────────────
  readonly schedule: ScheduledTransition | null;
  readonly pending: boolean;
  readonly breakPending: boolean;
  readonly applyPending: boolean;
  readonly remainingMs: number;
  /** Open the break dialog (the dialog itself lives in the provider). */
  readonly openBreak: () => void;
  /** Fire the pending transition now ("Hervat nu" / "Stop nu"). */
  readonly fireNow: () => void;
  /** Drop the pending transition without firing ("Annuleer"). */
  readonly cancel: () => void;
  /** Apply saved minutes: primes audio + schedules an auto-stopping timer. */
  readonly scheduleApply: (task: TaskMeta, seconds: number) => void;

  // ── Saved-minutes ledger ────────────────────────────────────────────────────
  readonly ledgerEntries: ReadonlyArray<LedgerEntry>;
  readonly netMinutes: number;
  readonly carryover: DayLedger | null;
  readonly addLedger: (minutes: number, note?: string) => void;
  readonly removeLedger: (id: string) => void;
  /** Move the carry-over balance into today (+ a toast). */
  readonly moveCarryover: () => void;
}

const LiveSessionContext = createContext<LiveSessionApi | null>(null);

export const LiveSessionContextProvider = LiveSessionContext.Provider;

export function useLiveSession(): LiveSessionApi {
  const ctx = useContext(LiveSessionContext);
  if (!ctx) throw new Error("useLiveSession must be used within <LiveSessionProvider>");
  return ctx;
}
