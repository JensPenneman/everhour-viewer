"use client";

import { useCallback, useState, type ReactNode } from "react";
import type { EverhourProfile } from "@/lib/everhour";
import type { ScheduledTransition, TaskMeta } from "@/lib/storage";
import { fmtDuration, toLocalIsoDate } from "@/lib/format";
import { useOnline } from "@/lib/query";
import type { ToastKind } from "@/shared/hooks";
import { useAlert, useLedger, useLive, useScheduledTransition } from "../hooks";
import type { FireInfo } from "../hooks";
import { toMeta } from "../lib/target-ticket";
import { BreakDialog } from "./BreakDialog";
import { LiveSessionContextProvider, type LiveSessionApi } from "./live-session-context";

export interface LiveSessionProviderProps {
  readonly profile: EverhourProfile | null;
  readonly canTrack: boolean;
  readonly pushToast: (message: string, kind?: ToastKind) => void;
  readonly children: ReactNode;
}

function taskLabel(t: TaskMeta): string {
  return t.linearKey ? `${t.linearKey} — ${t.name}` : t.name;
}

/**
 * Owns the single live session for the whole app: the timer, the
 * scheduled-transition engine, the saved-minutes ledger, and alerts. Mounted
 * once in the shell so the timer keeps ticking and a break auto-resumes (or an
 * apply auto-stops) regardless of which route is open — and so there is exactly
 * one engine, which can't double-fire a schedule.
 *
 * `children` (the page) is rendered as-is; only components that call
 * {@link useLiveSession} re-render on the 1s tick, so browsing a heavy page
 * while a timer runs stays cheap.
 */
export function LiveSessionProvider({
  profile,
  canTrack,
  pushToast,
  children,
}: LiveSessionProviderProps) {
  // `today` is stable for the session's lifetime; a tab left open across
  // midnight is an edge the ledger handles by date key, not worth a ticking dep.
  const [today] = useState(() => toLocalIsoDate(new Date()));
  const online = useOnline();
  const live = useLive(profile?.id ?? null, today, canTrack);
  const alert = useAlert(pushToast);
  const ledger = useLedger(today);

  const [breakDialogOpen, setBreakDialogOpen] = useState(false);

  const onFire = useCallback(
    (t: ScheduledTransition, info: FireInfo) => {
      const late =
        info.lateMs > 30_000 ? ` (${fmtDuration(Math.round(info.lateMs / 1000))} te laat)` : "";
      if (t.reason === "break") {
        alert.notify("Pauze voorbij", `Timer hervat op ${taskLabel(t.task)}${late}.`);
      } else if (info.booked && info.actualElapsedSec > 0) {
        ledger.bookAuto(-(info.actualElapsedSec / 60), `Geboekt op ${taskLabel(t.task)}`);
        alert.notify(
          "Geboekt",
          `${fmtDuration(info.actualElapsedSec)} geboekt op ${taskLabel(t.task)}.`,
        );
      } else {
        pushToast("Boeking gestopt — geen tijd geregistreerd.", "info");
      }
    },
    [alert, ledger, pushToast],
  );

  const onAbort = useCallback(
    (t: ScheduledTransition) => {
      pushToast(
        t.reason === "break" ? "Pauze beëindigd — timer handmatig gewijzigd." : "Boeking gestopt.",
        "info",
      );
    },
    [pushToast],
  );

  const engine = useScheduledTransition({
    timer: live.timer,
    start: live.start,
    stop: live.stop,
    busy: live.busy !== null,
    online,
    onFire,
    onAbort,
  });

  const startManual = useCallback(
    (taskId: string) => {
      alert.prime();
      engine.cancel(); // a manual start supersedes any pending break
      void live.start(taskId);
    },
    [alert, engine, live],
  );

  const openBreak = useCallback(() => {
    alert.prime();
    setBreakDialogOpen(true);
  }, [alert]);

  const confirmBreak = useCallback(
    (minutes: number) => {
      const task = live.timer?.task;
      setBreakDialogOpen(false);
      if (!task) return;
      alert.ensurePermission();
      void engine.scheduleBreak(toMeta(task), minutes * 60_000);
    },
    [alert, engine, live.timer],
  );

  const scheduleApply = useCallback(
    (task: TaskMeta, seconds: number) => {
      alert.prime();
      alert.ensurePermission();
      void engine.scheduleApply(task, seconds);
    },
    [alert, engine],
  );

  const moveCarryover = useCallback(() => {
    if (!ledger.carryover) return;
    ledger.moveDayToToday(ledger.carryover.date);
    pushToast("Saldo verplaatst naar vandaag.", "good");
  }, [ledger, pushToast]);

  // Rebuilt each render (the timer ticks) — that's fine: only useLiveSession
  // consumers re-render, the page passed as `children` does not.
  const api: LiveSessionApi = {
    today,
    online,
    ready: live.ready,
    loading: live.loading,
    error: live.error,
    busy: live.busy,
    timer: live.timer,
    elapsedSec: live.elapsedSec,
    clock: live.clock,
    clockControlUnavailable: live.clockControlUnavailable,
    todayEntries: live.todayEntries,
    todaySec: live.todaySec,
    weekSec: live.weekSec,
    stop: live.stop,
    clockIn: live.clockIn,
    clockOut: live.clockOut,
    startManual,
    schedule: engine.schedule,
    pending: engine.pending,
    breakPending: engine.schedule?.reason === "break",
    applyPending: engine.schedule?.reason === "apply",
    remainingMs: engine.remainingMs,
    openBreak,
    fireNow: engine.fireNow,
    cancel: engine.cancel,
    scheduleApply,
    ledgerEntries: ledger.entries,
    netMinutes: ledger.netMinutes,
    carryover: ledger.carryover,
    addLedger: ledger.add,
    removeLedger: ledger.remove,
    moveCarryover,
  };

  return (
    <LiveSessionContextProvider value={api}>
      {children}
      <BreakDialog
        open={breakDialogOpen}
        taskName={live.timer?.task ? taskLabel(toMeta(live.timer.task)) : ""}
        onClose={() => setBreakDialogOpen(false)}
        onConfirm={confirmBreak}
      />
    </LiveSessionContextProvider>
  );
}
