/**
 * Public surface of the query layer — the single communication layer for
 * server calls and localStorage-backed state (TanStack Query).
 */
export { makeQueryClient } from "./client";
export {
  createPersister,
  migrateLegacyCache,
  shouldDehydrateQuery,
  PERSIST_BUSTER,
  PERSIST_KEY,
  PERSIST_MAX_AGE,
} from "./persister";
export { liveFetch, type LiveFetchInit } from "./fetcher";
export { invalidateServerQueries, useStorageSync } from "./storage-sync";
export { authKeys, eventKeys, liveKeys, profileKey, syncKeys, timesheetKeys } from "./keys";
