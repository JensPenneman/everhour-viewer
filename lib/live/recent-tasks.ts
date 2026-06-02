import type { WeekRecord, WeekTaskRef } from "@/lib/everhour";

/**
 * The tasks you've most recently tracked, newest first and de-duplicated —
 * used for one-tap "start a timer" chips on the Vandaag view, so the common
 * case (resume something you were just on) needs no search.
 *
 * Walks cached weeks/days from the most recent date and collects each task
 * the first time it's seen.
 */
export function recentTasks(
  weeks: ReadonlyArray<WeekRecord>,
  limit = 8,
): ReadonlyArray<WeekTaskRef> {
  const seen = new Set<string>();
  const out: WeekTaskRef[] = [];

  const weeksDesc = [...weeks].sort((a, b) => b.week.from.localeCompare(a.week.from));
  for (const week of weeksDesc) {
    const daysDesc = [...week.days].sort((a, b) => b.date.localeCompare(a.date));
    for (const day of daysDesc) {
      for (const entry of day.entries) {
        if (seen.has(entry.task.id)) continue;
        seen.add(entry.task.id);
        out.push(entry.task);
        if (out.length >= limit) return out;
      }
    }
  }
  return out;
}
