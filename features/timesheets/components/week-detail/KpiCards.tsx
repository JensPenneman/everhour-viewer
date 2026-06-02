"use client";

import { KpiCard, StatusPill } from "@/shared/ui";
import type { WeekDay, WeekRecord } from "@/lib/everhour";
import { fmtDuration } from "@/lib/format";

export interface KpiCardsProps {
  readonly week: WeekRecord;
  readonly days: ReadonlyArray<WeekDay>;
  readonly taskCount: number;
}

export function KpiCards({ week, days, taskCount }: KpiCardsProps) {
  const workingDays = days.filter((d) => d.totalSeconds > 0);
  const avgPerDaySeconds = workingDays.length
    ? workingDays.reduce((a, d) => a + d.totalSeconds, 0) / workingDays.length
    : 0;

  return (
    <div className="grid grid-cols-3 gap-3 mb-7">
      <KpiCard
        label="Totale tijd"
        value={fmtDuration(week.totals.seconds)}
        hint={`${taskCount} ${taskCount === 1 ? "ticket" : "tickets"}`}
      />
      <KpiCard
        label="Werkdagen"
        value={String(workingDays.length)}
        hint={
          workingDays.length
            ? `gem. ${fmtDuration(avgPerDaySeconds)}/dag`
            : "geen werk geregistreerd"
        }
      />
      <KpiCard
        label="Status"
        value={<StatusPill status={week.approval.status} />}
        hint={
          week.approval.submittedAt
            ? `ingediend ${week.approval.submittedAt.slice(0, 10)}`
            : "niet ingediend"
        }
        small
      />
    </div>
  );
}
