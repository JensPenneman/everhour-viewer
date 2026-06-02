/**
 * Public surface of the query layer — the persisted TanStack Query client and
 * the keys for client-owned caches. Server I/O goes through tRPC
 * (see `@/lib/trpc/client`); streaming sync stays on `/api/sync`.
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
export { invalidateServerQueries, useStorageSync } from "./storage-sync";
export { useOnline } from "./use-online";
export { authKeys, eventKeys, profileKey, timesheetKeys } from "./keys";
