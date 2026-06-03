import { fmtDuration, fmtSignedDuration } from "@/lib/format";
import {
  DAY_TARGET_SECONDS,
  WEEK_TARGET_SECONDS,
  targetProgress,
} from "@/features/live/lib/targets";

export interface TargetsProps {
  /** Today seconds the meter counts: committed + running + ledger correction. */
  readonly todaySec: number;
  /** Week-to-date seconds: committed + running + ledger correction. */
  readonly weekSec: number;
  /** The ledger's signed contribution folded into `todaySec` (for the hint). */
  readonly todayCorrectionSec: number;
  /** The ledger's signed contribution folded into `weekSec` (for the hint). */
  readonly weekCorrectionSec: number;
}

/**
 * The two progress meters: how much is left to a full day (8u) and to the
 * full week (40u). Both tick live (their inputs include the running timer's
 * elapsed) and include the saved-minutes ledger, so a manual correction moves
 * the "remaining" immediately — annotated so its impact is visible.
 */
export function Targets({
  todaySec,
  weekSec,
  todayCorrectionSec,
  weekCorrectionSec,
}: TargetsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 mb-5">
      <TargetBar
        label="Volledige dag"
        targetLabel="8u"
        progress={targetProgress(todaySec, DAY_TARGET_SECONDS)}
        correctionSec={todayCorrectionSec}
      />
      <TargetBar
        label="Deze week"
        targetLabel="40u"
        progress={targetProgress(weekSec, WEEK_TARGET_SECONDS)}
        correctionSec={weekCorrectionSec}
      />
    </div>
  );
}

function TargetBar({
  label,
  targetLabel,
  progress,
  correctionSec,
}: {
  label: string;
  targetLabel: string;
  progress: ReturnType<typeof targetProgress>;
  correctionSec: number;
}) {
  const headline = progress.reached
    ? `✓ ${label} gehaald`
    : `Nog ${fmtDuration(progress.remainingSec)}`;

  return (
    <div className="bg-panel border border-border rounded-xl px-4 py-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-[11px] uppercase tracking-wider text-muted font-medium">{label}</div>
        <div className="text-[11.5px] text-muted-soft tabular-nums">
          {fmtDuration(progress.trackedSec)} / {targetLabel}
        </div>
      </div>
      <div
        className={`mt-1 text-[18px] font-semibold tabular-nums ${progress.reached ? "text-good" : ""}`}
      >
        {headline}
        {progress.reached && progress.overSec > 0 ? (
          <span className="text-[12.5px] font-medium text-muted">
            {" "}
            · +{fmtDuration(progress.overSec)}
          </span>
        ) : null}
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-border overflow-hidden">
        <div
          className={`h-full rounded-full ${progress.reached ? "bg-good" : "bg-accent"}`}
          style={{ width: `${progress.pct}%` }}
        />
      </div>
      {correctionSec !== 0 ? (
        <div className="mt-1.5 text-[11.5px] text-muted-soft tabular-nums">
          incl.{" "}
          <span className={correctionSec < 0 ? "text-bad" : "text-good"}>
            {fmtSignedDuration(correctionSec)}
          </span>{" "}
          correctie
        </div>
      ) : null}
    </div>
  );
}
