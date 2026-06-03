"use client";

import { Button, Panel } from "@/shared/ui";

export interface BreakCountdownProps {
  readonly taskName: string;
  readonly linearKey: string | null;
  readonly remainingMs: number;
  readonly onResumeNow: () => void;
  readonly onCancel: () => void;
}

/** Shown while a break is pending: counts down to the automatic resume. */
export function BreakCountdown({
  taskName,
  linearKey,
  remainingMs,
  onResumeNow,
  onCancel,
}: BreakCountdownProps) {
  return (
    <Panel className="px-5 py-5 mb-5 border-l-4 border-l-warn [view-transition-name:live-timer]">
      <div className="flex items-center gap-5">
        <div className="flex-1 min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-warn font-semibold">
            Pauze — hervat automatisch
          </div>
          <div className="mt-1.5 text-[15px] font-semibold truncate">
            {linearKey ? <span className="text-muted tabular-nums">{linearKey} · </span> : null}
            {taskName}
          </div>
        </div>
        <div className="text-[34px] font-semibold tabular-nums leading-none shrink-0">
          {fmtCountdown(remainingMs)}
        </div>
        <div className="flex flex-col gap-1.5 shrink-0">
          <Button variant="primary" size="sm" onClick={onResumeNow}>
            Hervat nu
          </Button>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Annuleer
          </Button>
        </div>
      </div>
    </Panel>
  );
}

/** "MM:SS" countdown (rounds the partial second up so it reads naturally). */
export function fmtCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
