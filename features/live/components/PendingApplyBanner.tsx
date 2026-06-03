"use client";

import { Button, Panel } from "@/shared/ui";
import { fmtCountdown } from "./BreakCountdown";

export interface PendingApplyBannerProps {
  readonly taskName: string;
  readonly linearKey: string | null;
  readonly remainingMs: number;
  readonly onStopNow: () => void;
}

/**
 * Shown while saved minutes are being applied: a real timer runs on the chosen
 * ticket and stops automatically when the countdown ends. "Stop nu" books less.
 */
export function PendingApplyBanner({
  taskName,
  linearKey,
  remainingMs,
  onStopNow,
}: PendingApplyBannerProps) {
  return (
    <Panel className="px-5 py-5 mb-5 border-l-4 border-l-accent [view-transition-name:live-timer]">
      <div className="flex items-center gap-5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-accent font-semibold">
            <span className="inline-block h-2 w-2 rounded-full bg-accent animate-pulse" />
            Bezig met boeken
          </div>
          <div className="mt-1.5 text-[15px] font-semibold truncate">
            {linearKey ? <span className="text-muted tabular-nums">{linearKey} · </span> : null}
            {taskName}
          </div>
          <div className="text-[12.5px] text-muted-soft mt-0.5">
            Stopt automatisch — de timerslot is tot dan bezet.
          </div>
        </div>
        <div className="text-[34px] font-semibold tabular-nums leading-none shrink-0">
          {fmtCountdown(remainingMs)}
        </div>
        <Button variant="danger" size="md" onClick={onStopNow} className="shrink-0">
          Stop nu
        </Button>
      </div>
    </Panel>
  );
}
