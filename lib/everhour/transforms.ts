import { isoWeekLabel } from "./iso-week";
import type { EverhourProfile, RawEntry, RawTimesheet, WeekEntry, WeekRecord } from "./types";

/** Mutable shadow of WeekDay used while assembling a week. */
interface MutableWeekDay {
  date: string;
  weekday: string;
  totalSeconds: number;
  entries: WeekEntry[];
  clockIn?: string | null;
  clockOut?: string | null;
  workTime?: number | null;
  breakTime?: number | null;
}

/**
 * Project Everhour's raw `/users/me` payload into the {@link EverhourProfile}
 * shape stored in the cache.
 *
 * The Everhour response includes fields we don't care about — and may grow
 * fields we shouldn't accidentally persist. This is a deliberate allow-list.
 */
export function sanitizeProfile(p: Record<string, unknown>): EverhourProfile {
  const get = <T>(k: string): T => p[k] as T;
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString().slice(0, 19),
    id: get<number>("id"),
    name: get<string>("name"),
    email: get<string>("email"),
    role: (get<string>("role") as string | null) ?? null,
    headline: (get<string>("headline") as string | null) ?? null,
    status: (get<string>("status") as string | null) ?? null,
    avatarUrl: (get<string>("avatarUrl") as string | null) ?? null,
    avatarUrlLarge: (get<string>("avatarUrlLarge") as string | null) ?? null,
    timezone: (get<number>("timezone") as number | null) ?? null,
    capacity: (get<number>("capacity") as number | null) ?? null,
    cost: (get<number>("cost") as number | null) ?? null,
    costHistory: p["costHistory"] ?? null,
    createdAt: (get<string>("createdAt") as string | null) ?? null,
    groups:
      (get<{ id: number; name: string }[]>("groups") as { id: number; name: string }[] | null) ??
      null,
  };
}

/**
 * Combine an Everhour timesheet header with its detailed entries into the
 * cache-shaped {@link WeekRecord}.
 *
 * The transform:
 *  - groups entries by date,
 *  - merges in timecard (clock-in/out) data,
 *  - sorts entries within a day by descending duration,
 *  - computes totals,
 *  - normalises approval status to the closed enum.
 */
export function buildWeek(ts: RawTimesheet, entries: ReadonlyArray<RawEntry>): WeekRecord {
  const days = new Map<string, MutableWeekDay>();

  const get = (date: string): MutableWeekDay => {
    const existing = days.get(date);
    if (existing) return existing;
    const created: MutableWeekDay = { date, weekday: "", totalSeconds: 0, entries: [] };
    days.set(date, created);
    return created;
  };

  for (const e of entries) {
    const day = get(e.date);
    day.totalSeconds += e.time;
    day.entries.push({
      task: {
        id: e.task.id,
        name: e.task.name,
        linearKey: e.task.number ?? null,
        url: e.task.url ?? null,
        labels: e.task.labels ?? [],
      },
      seconds: e.time,
      lockReasons: e.lockReasons ?? [],
    });
  }

  for (const tc of ts.timecards ?? []) {
    const day = get(tc.date);
    day.clockIn = tc.clockIn ?? null;
    day.clockOut = tc.clockOut ?? null;
    day.workTime = tc.workTime ?? null;
    day.breakTime = tc.breakTime ?? null;
  }

  const sortedDays = [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
  for (const d of sortedDays) {
    d.weekday = new Date(`${d.date}T00:00:00`).toLocaleDateString("en-US", { weekday: "long" });
    d.entries.sort((a, b) => b.seconds - a.seconds);
  }

  const totalSeconds = sortedDays.reduce((acc, d) => acc + d.totalSeconds, 0);
  const approval = ts.approval ?? null;
  const submittedAt = approval?.history?.find((h) => h.action === "submitted")?.createdAt ?? null;

  return {
    schemaVersion: 2,
    exportedAt: new Date().toISOString().slice(0, 19),
    user: { id: ts.user.id, name: ts.user.name, email: ts.user.email },
    week: {
      isoWeek: isoWeekLabel(ts.week.from),
      weekId: ts.week.id,
      from: ts.week.from,
      to: ts.week.to,
    },
    approval: {
      status: approval?.status ?? "unsubmitted",
      submittedAt,
      history: approval?.history ?? [],
    },
    totals: {
      seconds: totalSeconds,
      hours: Math.round((totalSeconds / 3600) * 100) / 100,
    },
    days: sortedDays,
  };
}
