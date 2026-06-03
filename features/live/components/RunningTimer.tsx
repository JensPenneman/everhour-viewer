"use client";

import { Button } from "@/shared/ui";
import type { Timer } from "@/lib/everhour";

export interface RunningTimerProps {
  readonly timer: Timer | null;
  readonly elapsedSec: number;
  readonly stopping: boolean;
  readonly onStop: () => void;
  /** Open the break dialog (stop now, auto-resume after a chosen break). */
  readonly onPause?: () => void;
  readonly pausing?: boolean;
}

/** The hero of the Vandaag view: the running timer with a live HH:MM:SS clock. */
export function RunningTimer({
  timer,
  elapsedSec,
  stopping,
  onStop,
  onPause,
  pausing,
}: RunningTimerProps) {
  if (!timer?.running || !timer.task) {
    return (
      <div className="bg-panel border border-border rounded-xl px-5 py-6 mb-5 text-center">
        <div className="text-[15px] font-medium text-muted">Geen timer loopt</div>
        <div className="text-[13px] text-muted-soft mt-1">
          Start hieronder een timer op een ticket.
        </div>
      </div>
    );
  }

  const { task } = timer;
  return (
    <div className="bg-panel border border-border rounded-xl px-5 py-5 mb-5 border-l-4 border-l-accent [view-transition-name:live-timer]">
      <div className="flex items-center gap-5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-accent font-semibold">
            <span className="inline-block h-2 w-2 rounded-full bg-accent animate-pulse" />
            Loopt nu
          </div>
          <div className="mt-1.5 text-[15px] font-semibold truncate">{task.name}</div>
          <div className="text-[12.5px] text-muted mt-0.5 tabular-nums">
            {task.url ? (
              <a
                href={task.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                {task.linearKey || "ticket"}
              </a>
            ) : (
              task.linearKey || ""
            )}
          </div>
        </div>
        <div className="text-[34px] font-semibold tabular-nums leading-none shrink-0">
          {fmtClock(elapsedSec)}
        </div>
        {onPause ? (
          <Button
            variant="default"
            size="md"
            onClick={onPause}
            disabled={stopping || pausing}
            className="shrink-0"
            title="Stop nu en hervat automatisch na een pauze"
          >
            {pausing ? "Pauze…" : "Pauze"}
          </Button>
        ) : null}
        <Button
          variant="danger"
          size="md"
          onClick={onStop}
          disabled={stopping || pausing}
          className="shrink-0"
        >
          {stopping ? "Stoppen…" : "Stop"}
        </Button>
      </div>
    </div>
  );
}

/** Live "H:MM:SS" for the running elapsed — seconds matter while it ticks. */
export function fmtClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
