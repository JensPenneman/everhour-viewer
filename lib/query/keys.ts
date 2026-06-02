/**
 * Query-key factories for the **client-owned** caches (timesheets, profile,
 * auth, day-events). Server reads (timer/clock/time/tasks/capabilities) are
 * tRPC procedures and own their own keys.
 *
 * The API key is deliberately **never** part of a key: it's a secret, it
 * would leak into the persisted blob and devtools, and a key-change is handled
 * by explicit invalidation instead (see storage-sync).
 */

export const timesheetKeys = {
  all: ["timesheets"] as const,
  weeks: () => ["timesheets", "weeks"] as const,
};

export const profileKey = ["profile"] as const;

export const authKeys = {
  apiKey: () => ["auth", "apiKey"] as const,
};

export const eventKeys = {
  all: ["events"] as const,
  manual: () => ["events", "manual"] as const,
  providers: (from: string, to: string) => ["events", "providers", from, to] as const,
};
