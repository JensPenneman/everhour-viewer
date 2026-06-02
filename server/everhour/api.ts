import "server-only";
import { sanitizeProfile } from "@/lib/everhour/transforms";
import type {
  ClockStatus,
  EverhourProfile,
  LiveEntry,
  MemberMap,
  RawEntry,
  RawTeamMember,
  RawTimesheet,
  TaskHit,
  Timer,
} from "@/lib/everhour/types";
import { everhourFetch } from "./client";

/**
 * High-level Everhour operations layered on top of {@link everhourFetch}.
 *
 * These compose request + sanitisation so that callers (typically the
 * server-side sync orchestrator) get cache-shaped values directly.
 *
 * Marked `server-only` so accidentally importing from a Client Component
 * fails at build-time rather than leaking the API key to the browser.
 */

export async function fetchProfile(key: string, signal?: AbortSignal): Promise<EverhourProfile> {
  const raw = await everhourFetch<Record<string, unknown>>("/users/me", { key, signal });
  return sanitizeProfile(raw);
}

/**
 * Fetch the team roster and project it into an id → display-name map.
 *
 * Used to resolve who performed each edit / clock event (the actor is only
 * an opaque user id in the `history` arrays). A failure here must not sink a
 * whole sync — the caller passes an empty map and the UI falls back to
 * "Gebruiker #id".
 */
export async function fetchTeamMembers(key: string, signal?: AbortSignal): Promise<MemberMap> {
  const raw = await everhourFetch<RawTeamMember[]>("/team/users", { key, signal });
  const map = new Map<number, string>();
  for (const m of raw) {
    if (typeof m?.id === "number" && m.name) map.set(m.id, m.name);
  }
  return map;
}

export interface FetchTimesheetListOptions {
  readonly key: string;
  readonly userId: number;
  readonly weeksBack: number;
  readonly signal?: AbortSignal;
}

/**
 * Fetch the list of timesheets for the user, filtered to those with either
 * recorded activity or an approval submission. Empty weeks (before the user
 * joined, vacation gaps without an approval) are filtered out.
 */
export async function fetchTimesheetList(
  opts: FetchTimesheetListOptions,
): Promise<ReadonlyArray<RawTimesheet>> {
  const today = new Date().toISOString().slice(0, 10);
  const past = new Date(Date.now() - opts.weeksBack * 7 * 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 10);

  const all = await everhourFetch<RawTimesheet[]>(`/users/${opts.userId}/timesheets`, {
    key: opts.key,
    signal: opts.signal,
    params: { from: past, to: today, limit: 500 },
  });

  return all.filter((ts) => ts.dailyTime || ts.approval);
}

export interface FetchWeekEntriesOptions {
  readonly key: string;
  readonly userId: number;
  readonly from: string;
  readonly to: string;
  readonly signal?: AbortSignal;
}

export function fetchWeekEntries(opts: FetchWeekEntriesOptions): Promise<ReadonlyArray<RawEntry>> {
  return everhourFetch<RawEntry[]>(`/users/${opts.userId}/time`, {
    key: opts.key,
    signal: opts.signal,
    params: { from: opts.from, to: opts.to },
  });
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Live tracking — timers, task search, clock, today/week time.              */
/* ────────────────────────────────────────────────────────────────────────── */

interface RawTaskish {
  readonly id?: string;
  readonly name?: string;
  readonly number?: string | null;
  readonly url?: string | null;
  readonly status?: string | null;
}

interface RawTimer {
  readonly status?: string;
  readonly duration?: number;
  readonly startedAt?: string | null;
  readonly task?: RawTaskish | null;
}

function sanitizeTask(t: RawTaskish | null | undefined): TaskHit | null {
  if (!t?.id) return null;
  return {
    id: t.id,
    name: t.name ?? "",
    linearKey: t.number ?? null,
    url: t.url ?? null,
    status: t.status ?? null,
  };
}

function sanitizeTimer(raw: RawTimer | null | undefined): Timer {
  const running = raw?.status === "active";
  return {
    running,
    durationSeconds: typeof raw?.duration === "number" ? raw.duration : 0,
    startedAt: raw?.startedAt ?? null,
    task: running ? sanitizeTask(raw?.task) : null,
  };
}

/** The current timer (`running: false` when none is active). */
export async function getCurrentTimer(key: string, signal?: AbortSignal): Promise<Timer> {
  const raw = await everhourFetch<RawTimer>("/timers/current", { key, signal });
  return sanitizeTimer(raw);
}

/**
 * Start a timer on a task, then confirm by re-reading the current timer —
 * so the result shape is consistent regardless of what `POST /timers`
 * echoes back. The write itself is single-attempt (see {@link everhourFetch}).
 */
export async function startTimer(
  key: string,
  taskId: string,
  signal?: AbortSignal,
): Promise<Timer> {
  await everhourFetch<RawTimer>("/timers", { key, method: "POST", body: { task: taskId }, signal });
  return getCurrentTimer(key, signal);
}

/** Stop the running timer; returns the now-idle timer state. */
export async function stopTimer(key: string, signal?: AbortSignal): Promise<Timer> {
  await everhourFetch<RawTimer>("/timers/current", { key, method: "DELETE", signal });
  return getCurrentTimer(key, signal);
}

/** Search tasks to start a timer on. */
export async function searchTasks(
  key: string,
  query: string,
  signal?: AbortSignal,
): Promise<ReadonlyArray<TaskHit>> {
  const raw = await everhourFetch<RawTaskish[]>("/tasks/search", {
    key,
    signal,
    params: { query, limit: 25 },
  });
  return (raw ?? []).map(sanitizeTask).filter((t): t is TaskHit => t !== null);
}

interface RawClockCard {
  readonly user?: number;
  readonly date?: string;
  readonly clockIn?: string | null;
  readonly clockOut?: string | null;
}

/** Today's attendance clock status for the user. */
export async function getClockToday(
  key: string,
  userId: number,
  today: string,
  signal?: AbortSignal,
): Promise<ClockStatus> {
  const raw = await everhourFetch<RawClockCard[]>("/timecards", {
    key,
    signal,
    params: { from: today, to: today, limit: 200 },
  });
  const card = (raw ?? []).find((c) => c.user === userId && c.date === today);
  return {
    date: today,
    clockedIn: !!card?.clockIn && !card?.clockOut,
    clockIn: card?.clockIn ?? null,
    clockOut: card?.clockOut ?? null,
  };
}

/**
 * Manual clock in/out. These write endpoints are best-effort — clock-in
 * already fires automatically when a timer starts, and not every account
 * exposes manual control — so callers should tolerate a 4xx and fall back to
 * showing status only.
 */
export async function clockInOut(
  key: string,
  action: "in" | "out",
  signal?: AbortSignal,
): Promise<void> {
  await everhourFetch<unknown>(`/timecards/clock-${action}`, { key, method: "POST", signal });
}

/** Committed time entries in `[from, to]`, trimmed for live day/week totals. */
export async function fetchTimeRange(
  key: string,
  userId: number,
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<ReadonlyArray<LiveEntry>> {
  const raw = await everhourFetch<RawEntry[]>(`/users/${userId}/time`, {
    key,
    signal,
    params: { from, to },
  });
  return (raw ?? []).map((e) => ({
    date: e.date,
    seconds: e.time,
    task: sanitizeTask(e.task) ?? {
      id: "",
      name: e.task?.name ?? "",
      linearKey: null,
      url: null,
      status: null,
    },
  }));
}
