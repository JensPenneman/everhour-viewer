"use client";

import { useCallback, useMemo, useState } from "react";
import { Button } from "@/shared/ui";
import type { EverhourProfile, WeekRecord } from "@/lib/everhour";
import type { ScheduledTransition, TaskMeta } from "@/lib/storage";
import {
  capitalize,
  fmtDateFull,
  fmtDuration,
  nlWeekday,
  parseLocalDate,
  toLocalIsoDate,
} from "@/lib/format";
import { useOnline } from "@/lib/query";
import type { ToastKind } from "@/shared/hooks";
import { useAlert, useLedger, useLive, useScheduledTransition, useTaskSearch } from "../hooks";
import type { FireInfo } from "../hooks";
import { recentTasks } from "@/features/live/lib/recent-tasks";
import { applyableSeconds, netMinutes } from "../lib/ledger";
import { candidateTargets, pickApplyTarget, toMeta } from "../lib/target-ticket";
import { BreakCountdown } from "./BreakCountdown";
import { BreakDialog } from "./BreakDialog";
import { ClockCard } from "./ClockCard";
import { PendingApplyBanner } from "./PendingApplyBanner";
import { RunningTimer } from "./RunningTimer";
import { SavedMinutesCard } from "./SavedMinutesCard";
import { StartTimer } from "./StartTimer";
import { Targets } from "./Targets";
import { TodayEntries } from "./TodayEntries";

export interface TodayViewProps {
  /** Whether tracking is possible at all — a user key or the server env key. */
  readonly canTrack: boolean;
  readonly profile: EverhourProfile | null;
  readonly weeks: ReadonlyArray<WeekRecord>;
  readonly onEnterKey: () => void;
  readonly onSync: () => void;
  /** The shell's toast pusher (pages have no tray of their own). */
  readonly pushToast: (message: string, kind?: ToastKind) => void;
}

function taskLabel(t: TaskMeta): string {
  return t.linearKey ? `${t.linearKey} — ${t.name}` : t.name;
}

/**
 * The live "Vandaag" surface — start/stop timers, watch the day/week targets
 * tick down, take a break that auto-resumes, and reconcile mis-logged minutes
 * via the saved-minutes ledger. The active-use half of the app.
 */
export function TodayView({
  canTrack,
  profile,
  weeks,
  onEnterKey,
  onSync,
  pushToast,
}: TodayViewProps) {
  const today = useMemo(() => toLocalIsoDate(new Date()), []);
  const online = useOnline();
  const live = useLive(profile?.id ?? null, today, canTrack);
  const search = useTaskSearch();
  const recent = useMemo(() => recentTasks(weeks, 8), [weeks]);
  const alert = useAlert(pushToast);
  const ledger = useLedger(today);

  const [breakDialogOpen, setBreakDialogOpen] = useState(false);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);

  // ── Saved-minutes apply target ──────────────────────────────────────────
  const targetInputs = useMemo(
    () => ({ todayEntries: live.todayEntries, runningTask: live.timer?.task ?? null, recent }),
    [live.todayEntries, live.timer, recent],
  );
  const candidates = useMemo(() => candidateTargets(targetInputs), [targetInputs]);
  const defaultTarget = useMemo(() => pickApplyTarget(targetInputs), [targetInputs]);
  const target = useMemo(
    () => candidates.find((c) => c.id === selectedTargetId) ?? defaultTarget,
    [candidates, selectedTargetId, defaultTarget],
  );

  // ── Scheduled-transition engine (break resume / apply auto-stop) ─────────
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

  const breakPending = engine.schedule?.reason === "break";
  const applyPending = engine.schedule?.reason === "apply";

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleStart = useCallback(
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

  const net = ledger.netMinutes;
  const applyHint = applyPending
    ? "Er loopt al een pauze of boeking."
    : net < 0
      ? "Negatief saldo — een timer kan geen tijd verwijderen. Corrigeer dit in Everhour."
      : net === 0
        ? "Niets te boeken."
        : !online
          ? "Offline — boeken kan nu niet."
          : !target
            ? "Geen ticket gekozen."
            : null;
  const canApply = net > 0 && !engine.pending && online && target !== null && live.ready;

  const onApply = useCallback(() => {
    if (!target || net <= 0) return;
    alert.prime();
    alert.ensurePermission();
    void engine.scheduleApply(target, applyableSeconds(net));
  }, [alert, engine, target, net]);

  const onMoveCarryover = useCallback(() => {
    if (!ledger.carryover) return;
    ledger.moveDayToToday(ledger.carryover.date);
    pushToast("Saldo verplaatst naar vandaag.", "good");
  }, [ledger, pushToast]);

  const runningTaskId = live.timer?.task?.id ?? null;
  const carryover = ledger.carryover
    ? { date: ledger.carryover.date, netMinutes: netMinutes(ledger.carryover) }
    : null;

  return (
    <div className="max-w-3xl">
      <div className="flex items-baseline gap-3 mb-1">
        <h2 className="m-0 text-[26px] font-semibold tracking-tight">Vandaag</h2>
        <span className="text-muted text-[13px]">
          {capitalize(nlWeekday(parseLocalDate(today)))} {fmtDateFull(today)}
        </span>
      </div>
      <div className="mb-6" />

      {!canTrack ? (
        <NotReady
          message="Stel je API-sleutel in om live te tracken."
          actionLabel="Sleutel instellen"
          onAction={onEnterKey}
        />
      ) : !profile ? (
        <NotReady
          message="Synchroniseer eerst om je profiel en tickets te laden."
          actionLabel="Synchroniseer"
          onAction={onSync}
        />
      ) : (
        <>
          {live.error ? (
            <div className="mb-4 rounded-xl border border-bad-bg bg-bad-bg px-4 py-2.5 text-[13px] text-bad">
              {live.error}
            </div>
          ) : null}

          {breakPending && engine.schedule ? (
            <BreakCountdown
              taskName={engine.schedule.task.name}
              linearKey={engine.schedule.task.linearKey}
              remainingMs={engine.remainingMs}
              onResumeNow={engine.fireNow}
              onCancel={engine.cancel}
            />
          ) : applyPending && engine.schedule ? (
            <PendingApplyBanner
              taskName={engine.schedule.task.name}
              linearKey={engine.schedule.task.linearKey}
              remainingMs={engine.remainingMs}
              onStopNow={engine.fireNow}
            />
          ) : (
            <RunningTimer
              timer={live.timer}
              elapsedSec={live.elapsedSec}
              stopping={live.busy === "stop"}
              onStop={live.stop}
              onPause={live.timer?.running ? openBreak : undefined}
              pausing={live.busy === "stop"}
            />
          )}

          <Targets todaySec={live.todaySec} weekSec={live.weekSec} />

          <StartTimer
            query={search.query}
            onQuery={search.setQuery}
            results={search.results}
            searching={search.searching}
            recent={recent}
            runningTaskId={runningTaskId}
            starting={live.busy === "start" || applyPending}
            onStart={handleStart}
          />

          <SavedMinutesCard
            entries={ledger.entries}
            netMinutes={net}
            onAdd={ledger.add}
            onRemove={ledger.remove}
            target={target}
            candidates={candidates}
            onSelectTarget={(t) => setSelectedTargetId(t.id)}
            canApply={canApply}
            applyHint={applyHint}
            onApply={onApply}
            carryover={carryover}
            onMoveCarryover={onMoveCarryover}
          />

          <ClockCard
            clock={live.clock}
            busy={live.busy === "clock"}
            unavailable={live.clockControlUnavailable}
            onClockIn={live.clockIn}
            onClockOut={live.clockOut}
          />

          <TodayEntries entries={live.todayEntries} />

          <BreakDialog
            open={breakDialogOpen}
            taskName={live.timer?.task ? taskLabel(toMeta(live.timer.task)) : ""}
            onClose={() => setBreakDialogOpen(false)}
            onConfirm={confirmBreak}
          />
        </>
      )}
    </div>
  );
}

function NotReady({
  message,
  actionLabel,
  onAction,
}: {
  message: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="bg-panel border border-border rounded-xl px-5 py-6 text-center">
      <div className="text-[14px] text-muted mb-3">{message}</div>
      <Button variant="primary" size="sm" onClick={onAction}>
        {actionLabel}
      </Button>
    </div>
  );
}
