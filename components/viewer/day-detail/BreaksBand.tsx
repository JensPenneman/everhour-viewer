import { KpiCard } from "@/components/ui";
import { fmtDuration } from "@/lib/format";
import type { DayBreaks } from "./day-audit";
import { InferredHint } from "./InferredHint";

const PAUZE_CAVEAT =
  "Everhour registreert geen pauzes. Dit is je aanwezigheid (prikklok) min je geregistreerde tijd.";

export interface BreaksBandProps {
  readonly breaks: DayBreaks;
  readonly clockIn: string | null | undefined;
  readonly clockOut: string | null | undefined;
  readonly taskCount: number;
}

/**
 * Three KPI cards: attendance, tracked, and the inferred break.
 *
 * The break is never presented as recorded fact — it carries the `ⓘ`
 * caveat, and collapses to "—" when it can't be derived (day still open, or
 * more tracked than attended).
 */
export function BreaksBand({ breaks, clockIn, clockOut, taskCount }: BreaksBandProps) {
  const attendanceHint = clockIn
    ? `${clockIn} – ${clockOut || "(open)"}${breaks.autoClosed ? " (automatisch afgesloten)" : ""}`
    : "geen prikklok";

  let pauzeValue: string;
  let pauzeHint: string;
  if (breaks.overTracked) {
    pauzeValue = "—";
    pauzeHint = "meer getrackt dan aanwezig";
  } else if (breaks.breakSec != null) {
    pauzeValue = fmtDuration(breaks.breakSec);
    pauzeHint = "≈ aanwezig − geregistreerd";
  } else {
    pauzeValue = "—";
    pauzeHint = breaks.hasClockOut ? "niet af te leiden" : "dag nog bezig";
  }

  return (
    <div className="grid grid-cols-3 gap-3 mb-5">
      <KpiCard
        label="Aanwezig"
        value={breaks.attendanceSec != null ? fmtDuration(breaks.attendanceSec) : "—"}
        hint={attendanceHint}
      />
      <KpiCard
        label="Geregistreerd"
        value={fmtDuration(breaks.trackedSec)}
        hint={`${taskCount} ${taskCount === 1 ? "ticket" : "tickets"}`}
      />
      <KpiCard
        label={
          <span className="inline-flex items-center">
            Pauze (afgeleid)
            <InferredHint text={PAUZE_CAVEAT} />
          </span>
        }
        value={pauzeValue}
        hint={pauzeHint}
      />
    </div>
  );
}
