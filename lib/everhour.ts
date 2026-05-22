const API_BASE = "https://api.everhour.com";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "unsubmitted";

export type EverhourProfile = {
  schemaVersion: 1;
  exportedAt: string;
  id: number;
  name: string;
  email: string;
  role: string | null;
  headline: string | null;
  status: string | null;
  avatarUrl: string | null;
  avatarUrlLarge: string | null;
  timezone: number | null;
  capacity: number | null;
  cost: number | null;
  costHistory: unknown;
  createdAt: string | null;
  groups: { id: number; name: string }[] | null;
};

export type WeekEntry = {
  task: {
    id: string;
    name: string;
    linearKey: string | null;
    url: string | null;
    labels: string[];
  };
  seconds: number;
  lockReasons: string[];
};

export type WeekDay = {
  date: string;
  weekday: string;
  totalSeconds: number;
  entries: WeekEntry[];
  clockIn?: string | null;
  clockOut?: string | null;
  workTime?: number | null;
  breakTime?: number | null;
};

export type WeekRecord = {
  schemaVersion: 2;
  exportedAt: string;
  user: { id: number; name: string; email: string };
  week: { isoWeek: string; weekId: number; from: string; to: string };
  approval: {
    status: ApprovalStatus;
    submittedAt: string | null;
    history: { action: string; createdAt: string }[];
  };
  totals: { seconds: number; hours: number };
  days: WeekDay[];
};

export type RawTimesheet = {
  user: { id: number; name: string; email: string };
  week: { id: number; from: string; to: string };
  dailyTime?: Record<string, number>;
  timecards?: RawTimecard[];
  approval?: {
    status: ApprovalStatus;
    history?: { action: string; createdAt: string }[];
  };
};

type RawTask = {
  id: string;
  name: string;
  number?: string | null;
  url?: string | null;
  labels?: string[];
};

type RawEntry = {
  date: string;
  time: number;
  task: RawTask;
  lockReasons?: string[];
};

type RawTimecard = {
  date: string;
  clockIn?: string | null;
  clockOut?: string | null;
  workTime?: number | null;
  breakTime?: number | null;
};

export class EverhourError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function api<T>(path: string, key: string, params?: Record<string, string | number>): Promise<T> {
  const url = new URL(API_BASE + path);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  }

  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 400 * attempt));
    try {
      const resp = await fetch(url, { headers: { "X-Api-Key": key }, cache: "no-store" });
      if (!resp.ok) {
        const body = await resp.text().catch(() => "");
        // Retry only on 429 and 5xx; surface 4xx immediately
        if (resp.status !== 429 && resp.status < 500) {
          throw new EverhourError(resp.status, `Everhour ${resp.status} on ${path}${body ? `: ${body.slice(0, 200)}` : ""}`);
        }
        lastErr = new EverhourError(resp.status, `Everhour ${resp.status} on ${path}${body ? `: ${body.slice(0, 200)}` : ""}`);
        continue;
      }
      return (await resp.json()) as T;
    } catch (e) {
      if (e instanceof EverhourError) throw e;
      lastErr = e;
    }
  }
  if (lastErr instanceof Error) throw new EverhourError(0, `Network error on ${path}: ${lastErr.message}`);
  throw new EverhourError(0, `Network error on ${path}`);
}

export function isoWeekLabel(fromIso: string): string {
  const d = new Date(fromIso + "T00:00:00Z");
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const diff = target.getTime() - firstThursday.getTime();
  const week = 1 + Math.round(diff / 604_800_000);
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function sanitizeProfile(p: Record<string, unknown>): EverhourProfile {
  const get = <T>(k: string): T => p[k] as T;
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString().slice(0, 19),
    id: get<number>("id"),
    name: get<string>("name"),
    email: get<string>("email"),
    role: get<string>("role") ?? null,
    headline: get<string>("headline") ?? null,
    status: get<string>("status") ?? null,
    avatarUrl: get<string>("avatarUrl") ?? null,
    avatarUrlLarge: get<string>("avatarUrlLarge") ?? null,
    timezone: get<number>("timezone") ?? null,
    capacity: get<number>("capacity") ?? null,
    cost: get<number>("cost") ?? null,
    costHistory: p["costHistory"] ?? null,
    createdAt: get<string>("createdAt") ?? null,
    groups: get<{ id: number; name: string }[]>("groups") ?? null,
  };
}

export function buildWeek(ts: RawTimesheet, entries: RawEntry[]): WeekRecord {
  const days = new Map<string, WeekDay>();
  for (const e of entries) {
    let d = days.get(e.date);
    if (!d) {
      d = { date: e.date, weekday: "", totalSeconds: 0, entries: [] };
      days.set(e.date, d);
    }
    d.totalSeconds += e.time;
    d.entries.push({
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
    let d = days.get(tc.date);
    if (!d) {
      d = { date: tc.date, weekday: "", totalSeconds: 0, entries: [] };
      days.set(tc.date, d);
    }
    d.clockIn = tc.clockIn ?? null;
    d.clockOut = tc.clockOut ?? null;
    d.workTime = tc.workTime ?? null;
    d.breakTime = tc.breakTime ?? null;
  }

  const sorted = [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
  for (const d of sorted) {
    d.weekday = new Date(d.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long" });
    d.entries.sort((a, b) => b.seconds - a.seconds);
  }

  const totalSeconds = sorted.reduce((acc, d) => acc + d.totalSeconds, 0);
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
    totals: { seconds: totalSeconds, hours: Math.round((totalSeconds / 3600) * 100) / 100 },
    days: sorted,
  };
}

export async function fetchProfile(key: string): Promise<EverhourProfile> {
  const raw = await api<Record<string, unknown>>("/users/me", key);
  return sanitizeProfile(raw);
}

export async function fetchTimesheetList(key: string, userId: number, weeksBack: number): Promise<RawTimesheet[]> {
  const today = new Date().toISOString().slice(0, 10);
  const past = new Date(Date.now() - weeksBack * 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const all = await api<RawTimesheet[]>(`/users/${userId}/timesheets`, key, {
    from: past,
    to: today,
    limit: 500,
  });
  return all.filter((ts) => ts.dailyTime || ts.approval);
}

export async function fetchWeekEntries(key: string, userId: number, fromIso: string, toIso: string): Promise<RawEntry[]> {
  return api<RawEntry[]>(`/users/${userId}/time`, key, { from: fromIso, to: toIso });
}
