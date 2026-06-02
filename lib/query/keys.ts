/**
 * Query-key factories — the single source of truth for every cache key.
 *
 * Keys are grouped by concern (timesheets, profile, live, sync, events,
 * auth) so a feature can invalidate its own slice (`liveKeys.all`) without
 * touching others. The API key is deliberately **never** part of a key: it's
 * a secret, it would leak into the persisted blob and devtools, and a
 * key-change is handled by explicit invalidation instead (see storage-sync).
 */

export const timesheetKeys = {
  all: ["timesheets"] as const,
  weeks: () => ["timesheets", "weeks"] as const,
};

export const profileKey = ["profile"] as const;

export const authKeys = {
  apiKey: () => ["auth", "apiKey"] as const,
};

export const syncKeys = {
  capability: () => ["sync", "capability"] as const,
};

export const liveKeys = {
  all: ["live"] as const,
  timer: () => ["live", "timer"] as const,
  clock: (userId: number, today: string) => ["live", "clock", userId, today] as const,
  time: (userId: number, from: string, to: string) => ["live", "time", userId, from, to] as const,
  tasks: (q: string) => ["live", "tasks", q] as const,
};

export const eventKeys = {
  all: ["events"] as const,
  manual: () => ["events", "manual"] as const,
  providers: (from: string, to: string) => ["events", "providers", from, to] as const,
};
