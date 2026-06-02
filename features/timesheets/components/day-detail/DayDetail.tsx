"use client";

import { useMemo } from "react";
import { Button, SectionTitle } from "@/shared/ui";
import type { DayEvent } from "@/lib/events";
import type { WeekDay, WeekRecord } from "@/lib/everhour";
import { capitalize, fmtDateFull, fmtDuration, nlWeekday, parseLocalDate } from "@/lib/format";
import { EventChip } from "@/features/events";
import { BreaksBand } from "./BreaksBand";
import { ChangeLog } from "./ChangeLog";
import { CorrectionPill } from "./CorrectionPill";
import { EntryTable } from "./EntryTable";
import { TimeBar } from "./TimeBar";
import { buildChangeLog, buildTimeline, dayBreaks, foreignCorrectionCount } from "./day-audit";

export interface DayDetailProps {
  readonly week: WeekRecord;
  readonly day: WeekDay;
  readonly events?: ReadonlyArray<DayEvent>;
  /** Profile timezone offset in hours (e.g. 2 for UTC+2); null if unknown. */
  readonly tzOffsetHours: number | null;
  readonly onBack: () => void;
}

/**
 * Dedicated day view: leads with what changed (and who changed it), then the
 * attendance/break summary + approximate timeline, then the per-ticket
 * ledger. Order is deliberate — the correction is the #1 thing the user came
 * to see.
 */
export function DayDetail({ week, day, events, tzOffsetHours, onBack }: DayDetailProps) {
  const ownerId = week.user.id;

  const changeLog = useMemo(() => buildChangeLog(day, ownerId), [day, ownerId]);
  const foreignCount = useMemo(() => foreignCorrectionCount(changeLog), [changeLog]);
  const breaks = useMemo(() => dayBreaks(day), [day]);
  const timeline = useMemo(() => buildTimeline(day, tzOffsetHours), [day, tzOffsetHours]);

  const taskCount = new Set(day.entries.map((e) => e.task.id)).size;
  const dayOpen = !breaks.hasClockOut;

  return (
    <div className="max-w-5xl">
      <Button variant="ghost" size="sm" onClick={onBack} className="mb-4 -ml-2 text-muted">
        ‹ Terug naar week {week.week.isoWeek}
      </Button>

      <div className="flex items-baseline flex-wrap gap-3 mb-1">
        <h2 className="m-0 text-[26px] font-semibold tracking-tight">
          {capitalize(nlWeekday(parseLocalDate(day.date)))} {fmtDateFull(day.date)}
        </h2>
        {foreignCount > 0 ? (
          <CorrectionPill title="Iemand anders heeft je tijd op deze dag gewijzigd">
            ⚠ {foreignCount} {foreignCount === 1 ? "correctie" : "correcties"} door iemand anders
          </CorrectionPill>
        ) : null}
      </div>

      <div className="text-muted text-[13px] mb-6 flex items-center flex-wrap gap-x-3 gap-y-1.5">
        <span>
          {day.clockIn
            ? `Aanwezig ${day.clockIn} – ${day.clockOut || "(open)"}${
                breaks.attendanceSec != null ? ` · ${fmtDuration(breaks.attendanceSec)}` : ""
              }`
            : "Geen prikklokgegevens"}
        </span>
        {events && events.length > 0 ? (
          <span className="flex flex-wrap items-center gap-1.5">
            {events.map((ev) => (
              <EventChip key={ev.id} event={ev} compact />
            ))}
          </span>
        ) : null}
      </div>

      <ChangeLog
        rows={changeLog}
        foreignCount={foreignCount}
        dayDate={day.date}
        tzOffsetHours={tzOffsetHours}
      />

      <SectionTitle>Aanwezigheid &amp; pauze</SectionTitle>
      <BreaksBand
        breaks={breaks}
        clockIn={day.clockIn}
        clockOut={day.clockOut}
        taskCount={taskCount}
      />
      {timeline.hasData ? <TimeBar timeline={timeline} dayOpen={dayOpen} /> : null}

      <EntryTable day={day} ownerId={ownerId} tzOffsetHours={tzOffsetHours} />
    </div>
  );
}
