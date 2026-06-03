"use client";

import { useMemo, useState } from "react";
import { Button } from "@/shared/ui";
import type { EverhourProfile, WeekRecord } from "@/lib/everhour";
import { capitalize, fmtDateFull, nlWeekday, parseLocalDate } from "@/lib/format";
import { useTaskSearch } from "../hooks";
import { recentTasks } from "@/features/live/lib/recent-tasks";
import { applyableSeconds, netMinutes } from "../lib/ledger";
import { candidateTargets, pickApplyTarget } from "../lib/target-ticket";
import { BreakCountdown } from "./BreakCountdown";
import { ClockCard } from "./ClockCard";
import { useLiveSession } from "./live-session-context";
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
}

/**
 * The live "Vandaag" surface — start/stop timers, watch the day/week targets
 * tick down, take a break that auto-resumes, and reconcile mis-logged minutes
 * via the saved-minutes ledger. Live state comes from the shared
 * {@link useLiveSession} (owned by the shell), so the timer survives navigation;
 * this view adds the task search, apply-target picker, and full layout.
 */
export function TodayView({ canTrack, profile, weeks, onEnterKey, onSync }: TodayViewProps) {
  const s = useLiveSession();
  const today = s.today;
  const search = useTaskSearch();
  const recent = useMemo(() => recentTasks(weeks, 8), [weeks]);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);

  // ── Saved-minutes apply target ──────────────────────────────────────────
  const targetInputs = useMemo(
    () => ({ todayEntries: s.todayEntries, runningTask: s.timer?.task ?? null, recent }),
    [s.todayEntries, s.timer, recent],
  );
  const candidates = useMemo(() => candidateTargets(targetInputs), [targetInputs]);
  const defaultTarget = useMemo(() => pickApplyTarget(targetInputs), [targetInputs]);
  const target = useMemo(
    () => candidates.find((c) => c.id === selectedTargetId) ?? defaultTarget,
    [candidates, selectedTargetId, defaultTarget],
  );

  const net = s.netMinutes;
  const applyHint = s.applyPending
    ? "Er loopt al een pauze of boeking."
    : net < 0
      ? "Negatief saldo — een timer kan geen tijd verwijderen. Corrigeer dit in Everhour."
      : net === 0
        ? "Niets te boeken."
        : !s.online
          ? "Offline — boeken kan nu niet."
          : !target
            ? "Geen ticket gekozen."
            : null;
  const canApply = net > 0 && !s.pending && s.online && target !== null && s.ready;

  const carryover = s.carryover
    ? { date: s.carryover.date, netMinutes: netMinutes(s.carryover) }
    : null;
  const runningTaskId = s.timer?.task?.id ?? null;

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
          {s.error ? (
            <div className="mb-4 rounded-xl border border-bad-bg bg-bad-bg px-4 py-2.5 text-[13px] text-bad">
              {s.error}
            </div>
          ) : null}

          {s.breakPending && s.schedule ? (
            <BreakCountdown
              taskName={s.schedule.task.name}
              linearKey={s.schedule.task.linearKey}
              remainingMs={s.remainingMs}
              onResumeNow={s.fireNow}
              onCancel={s.cancel}
            />
          ) : s.applyPending && s.schedule ? (
            <PendingApplyBanner
              taskName={s.schedule.task.name}
              linearKey={s.schedule.task.linearKey}
              remainingMs={s.remainingMs}
              onStopNow={s.fireNow}
            />
          ) : (
            <RunningTimer
              timer={s.timer}
              elapsedSec={s.elapsedSec}
              stopping={s.busy === "stop"}
              onStop={s.stop}
              onPause={s.timer?.running ? s.openBreak : undefined}
              pausing={s.busy === "stop"}
            />
          )}

          <Targets
            todaySec={s.correctedTodaySec}
            weekSec={s.correctedWeekSec}
            todayCorrectionSec={s.todayCorrectionSec}
            weekCorrectionSec={s.weekCorrectionSec}
          />

          <StartTimer
            query={search.query}
            onQuery={search.setQuery}
            results={search.results}
            searching={search.searching}
            recent={recent}
            runningTaskId={runningTaskId}
            starting={s.busy === "start" || s.applyPending}
            onStart={s.startManual}
          />

          <SavedMinutesCard
            entries={s.ledgerEntries}
            netMinutes={net}
            onAdd={s.addLedger}
            onRemove={s.removeLedger}
            target={target}
            candidates={candidates}
            onSelectTarget={(t) => setSelectedTargetId(t.id)}
            canApply={canApply}
            applyHint={applyHint}
            onApply={() => {
              if (target && net > 0) s.scheduleApply(target, applyableSeconds(net));
            }}
            carryover={carryover}
            onMoveCarryover={s.moveCarryover}
          />

          <ClockCard
            clock={s.clock}
            busy={s.busy === "clock"}
            unavailable={s.clockControlUnavailable}
            onClockIn={s.clockIn}
            onClockOut={s.clockOut}
          />

          <TodayEntries entries={s.todayEntries} />
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
