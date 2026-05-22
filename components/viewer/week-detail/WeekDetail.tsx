"use client";

import { useMemo } from "react";
import { SectionTitle, StatusPill } from "@/components/ui";
import type { WeekRecord } from "@/lib/everhour";
import { fmtDateFull } from "@/lib/format";
import { DailyChart } from "./DailyChart";
import { DayBreakdown } from "./DayBreakdown";
import { KpiCards } from "./KpiCards";
import { TaskTable } from "./TaskTable";
import { aggregateTasks, fullWeekDays } from "./utils";

export interface WeekDetailProps {
  readonly week: WeekRecord;
}

export function WeekDetail({ week }: WeekDetailProps) {
  const days = useMemo(() => fullWeekDays(week), [week]);
  const tasks = useMemo(() => aggregateTasks(days), [days]);

  return (
    <div className="max-w-5xl">
      <div className="flex items-baseline gap-3 mb-1">
        <h2 className="m-0 text-[26px] font-semibold tracking-tight tabular-nums">
          {week.week.isoWeek}
        </h2>
        <StatusPill status={week.approval.status} />
      </div>
      <div className="text-[var(--muted)] text-[13px] mb-6">
        {fmtDateFull(week.week.from)} t/m {fmtDateFull(week.week.to)}
        {week.approval.submittedAt ? ` · ingediend ${week.approval.submittedAt.slice(0, 10)}` : ""}
      </div>

      <KpiCards week={week} days={days} taskCount={tasks.length} />

      <SectionTitle>Per dag</SectionTitle>
      <DailyChart days={days} />

      <SectionTitle>Per ticket</SectionTitle>
      <TaskTable tasks={tasks} />

      <SectionTitle>Dagelijkse details</SectionTitle>
      <DayBreakdown days={days} />
    </div>
  );
}
