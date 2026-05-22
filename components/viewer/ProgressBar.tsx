"use client";

import type { SyncProgress } from "@/hooks";

export interface ProgressBarProps {
  readonly progress: SyncProgress;
}

/**
 * Header-area progress indicator shown during sync.
 *
 * Switches between an indeterminate animation (when the server hasn't yet
 * declared a total — i.e., before the `plan` event) and a determinate bar
 * filling per-week.
 */
export function ProgressBar({ progress }: ProgressBarProps) {
  const indeterminate = progress.total === 0 && progress.phase !== "done";
  const pct =
    progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : progress.phase === "done"
        ? 100
        : 0;

  return (
    <div className="flex items-center gap-3">
      <div className="text-[12px] text-[var(--muted)] truncate min-w-0 flex-shrink-0 max-w-[420px]">
        {progress.message}
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={indeterminate ? undefined : pct}
        className="relative flex-1 h-1.5 bg-[var(--border)] rounded-full overflow-hidden max-w-[280px]"
      >
        {indeterminate ? (
          <div className="absolute inset-y-0 w-1/3 bg-[var(--accent)] rounded-full animate-progress-indeterminate" />
        ) : (
          <div
            className="absolute inset-y-0 left-0 bg-[var(--accent)] rounded-full transition-all duration-200"
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
      <div className="text-[11px] text-[var(--muted)] tabular-nums whitespace-nowrap">
        <span className="text-[var(--good)] font-medium">{progress.counts.new}</span> nieuw ·{" "}
        <span className="text-[var(--accent)] font-medium">{progress.counts.updated}</span>{" "}
        bijgewerkt · <span>{progress.counts.skipped}</span> ongewijzigd
      </div>
    </div>
  );
}
