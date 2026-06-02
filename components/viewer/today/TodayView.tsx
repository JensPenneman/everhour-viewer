"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui";
import type { EverhourProfile, WeekRecord } from "@/lib/everhour";
import { capitalize, fmtDateFull, nlWeekday, parseLocalDate, toLocalIsoDate } from "@/lib/format";
import { useLive, useTaskSearch } from "@/hooks";
import { recentTasks } from "@/lib/live/recent-tasks";
import { ClockCard } from "./ClockCard";
import { RunningTimer } from "./RunningTimer";
import { StartTimer } from "./StartTimer";
import { Targets } from "./Targets";
import { TodayEntries } from "./TodayEntries";

export interface TodayViewProps {
  /** Stored user key for the request header (may be null when an env key is used). */
  readonly apiKey: string | null;
  /** Whether tracking is possible at all — a user key or the server env key. */
  readonly canTrack: boolean;
  readonly profile: EverhourProfile | null;
  readonly weeks: ReadonlyArray<WeekRecord>;
  readonly onEnterKey: () => void;
  readonly onSync: () => void;
}

/**
 * The live "Vandaag" surface — start/stop timers, watch the day/week targets
 * tick down, and see today's tracked time. The active-use half of the app.
 */
export function TodayView({
  apiKey,
  canTrack,
  profile,
  weeks,
  onEnterKey,
  onSync,
}: TodayViewProps) {
  const today = useMemo(() => toLocalIsoDate(new Date()), []);
  const live = useLive(apiKey, profile?.id ?? null, today, canTrack);
  const search = useTaskSearch(apiKey);
  const recent = useMemo(() => recentTasks(weeks, 8), [weeks]);

  const runningTaskId = live.timer?.task?.id ?? null;

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

          <RunningTimer
            timer={live.timer}
            elapsedSec={live.elapsedSec}
            stopping={live.busy === "stop"}
            onStop={live.stop}
          />

          <Targets todaySec={live.todaySec} weekSec={live.weekSec} />

          <StartTimer
            query={search.query}
            onQuery={search.setQuery}
            results={search.results}
            searching={search.searching}
            recent={recent}
            runningTaskId={runningTaskId}
            starting={live.busy === "start"}
            onStart={live.start}
          />

          <ClockCard
            clock={live.clock}
            busy={live.busy === "clock"}
            unavailable={live.clockControlUnavailable}
            onClockIn={live.clockIn}
            onClockOut={live.clockOut}
          />

          <TodayEntries entries={live.todayEntries} />
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
