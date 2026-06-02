import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import type { Query, QueryClient } from "@tanstack/react-query";
// Import from the types module directly, not the `@/lib/everhour` barrel: the
// barrel re-exports the `server-only` api.ts, and a *value* import (the schema
// version) would drag `server-only` into the client bundle. (Phase 3 splits
// the barrel so this is moot.)
import { WEEK_SCHEMA_VERSION, type EverhourProfile, type WeekRecord } from "@/lib/everhour/types";
import { profileKey, timesheetKeys } from "./keys";

/** localStorage key holding the persisted query cache (replaces the old data blob). */
export const PERSIST_KEY = "everhour_viewer_rq_v1";

/** How long a persisted cache survives a cold start. Must equal `gcTime` (see client.ts). */
export const PERSIST_MAX_AGE = 1000 * 60 * 60 * 24 * 14; // 14 days

/**
 * Cache-busting token. Changing it discards the whole persisted blob on the
 * next restore — our coarse "the persisted shape changed incompatibly" hatch.
 * Tied to the week schema version so a bump there wipes stale weeks.
 */
export const PERSIST_BUSTER = `weeks${WEEK_SCHEMA_VERSION}`;

/** The pre-TanStack cache blob, migrated into the query cache once on upgrade. */
const LEGACY_CACHE_KEY = "everhour_viewer_data_v1";

/** Build the localStorage persister (a no-op on the server, where there's no window). */
export function createPersister() {
  return createSyncStoragePersister({
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
    key: PERSIST_KEY,
    // Coalesce the rapid setQueryData calls of a streaming sync into ~1 write/sec.
    throttleTime: 1000,
  });
}

/** Query-key prefixes whose data is durable enough to persist to disk. */
const PERSISTED_PREFIXES: ReadonlyArray<ReadonlyArray<string>> = [
  timesheetKeys.weeks(),
  profileKey,
];

function prefixMatches(key: readonly unknown[], prefix: ReadonlyArray<string>): boolean {
  return prefix.every((seg, i) => key[i] === seg);
}

/**
 * Persist only durable, successful queries (weeks + profile). Volatile
 * server reads (timer/clock/time/tasks) and the capability probe are never
 * written to disk — a persisted "running timer" would be misleading offline.
 */
export function shouldDehydrateQuery(query: Query): boolean {
  if (query.state.status !== "success") return false;
  return PERSISTED_PREFIXES.some((prefix) => prefixMatches(query.queryKey, prefix));
}

/**
 * One-time migration of the legacy `everhour_viewer_data_v1` blob into the
 * query cache, run after restore completes. Lets existing users keep their
 * cache on upgrade (and keeps the sync e2e's localStorage seed valid). Only
 * seeds keys that aren't already populated, then removes the legacy blob.
 */
export function migrateLegacyCache(client: QueryClient): void {
  if (typeof window === "undefined") return;
  const raw = window.localStorage.getItem(LEGACY_CACHE_KEY);
  if (!raw) return;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      const blob = parsed as {
        profile?: EverhourProfile | null;
        weeks?: ReadonlyArray<WeekRecord>;
      };
      const existing = client.getQueryData<ReadonlyArray<WeekRecord>>(timesheetKeys.weeks());
      if ((!existing || existing.length === 0) && Array.isArray(blob.weeks)) {
        client.setQueryData(timesheetKeys.weeks(), blob.weeks);
      }
      if (!client.getQueryData(profileKey) && blob.profile) {
        client.setQueryData(profileKey, blob.profile);
      }
    }
  } catch {
    // Corrupt legacy blob — drop it silently.
  }
  window.localStorage.removeItem(LEGACY_CACHE_KEY);
}
