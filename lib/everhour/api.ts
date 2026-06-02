import "server-only";
import { everhourFetch } from "./client";
import { sanitizeProfile } from "./transforms";
import type { EverhourProfile, MemberMap, RawEntry, RawTeamMember, RawTimesheet } from "./types";

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
