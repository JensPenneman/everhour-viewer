import type { WeekDay, WeekRecord, WeekTaskRef } from "@/lib/everhour";
import { parseLocalDate, toLocalIsoDate } from "@/lib/format";

/**
 * Project a {@link WeekRecord} onto exactly seven calendar days.
 *
 * The Everhour API only returns days that contain entries or timecards, so
 * an in-progress week may yield 4 days. The UI needs all 7 so the chart
 * stays evenly spaced and the per-day list shows blanks for missing days.
 */
export function fullWeekDays(week: WeekRecord): ReadonlyArray<WeekDay> {
  const start = parseLocalDate(week.week.from);
  const byDate = new Map(week.days.map((d) => [d.date, d]));
  const result: WeekDay[] = [];

  for (let i = 0; i < 7; i++) {
    const dt = new Date(start);
    dt.setDate(dt.getDate() + i);
    const iso = toLocalIsoDate(dt);
    const existing = byDate.get(iso);
    result.push(
      existing ?? {
        date: iso,
        weekday: dt.toLocaleDateString("en-US", { weekday: "long" }),
        totalSeconds: 0,
        entries: [],
      },
    );
  }
  return result;
}

export interface TaskTotal {
  readonly task: WeekTaskRef;
  readonly seconds: number;
}

/** Sum entries across all days, grouped by task, sorted descending. */
export function aggregateTasks(days: ReadonlyArray<WeekDay>): ReadonlyArray<TaskTotal> {
  const byId = new Map<string, { task: WeekTaskRef; seconds: number }>();
  for (const day of days) {
    for (const e of day.entries) {
      const cur = byId.get(e.task.id) ?? { task: e.task, seconds: 0 };
      cur.seconds += e.seconds;
      byId.set(e.task.id, cur);
    }
  }
  return [...byId.values()].sort((a, b) => b.seconds - a.seconds);
}
