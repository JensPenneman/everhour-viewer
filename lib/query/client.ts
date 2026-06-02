import { QueryClient } from "@tanstack/react-query";
import { errorStatus } from "@/lib/errors";
import { PERSIST_MAX_AGE } from "./persister";

/** A read is worth retrying for network errors, 429, and 5xx — but not 4xx. */
function isRetriableRead(error: unknown): boolean {
  const status = errorStatus(error);
  if (status === undefined) return true; // network-level failure
  return status === 429 || status >= 500;
}

/**
 * The shared QueryClient.
 *
 * - `gcTime === PERSIST_MAX_AGE`: a persisted query that's restored on a cold
 *   start with no active observer must not be garbage-collected before a
 *   component mounts to read it (which would then persist an empty cache —
 *   silent data loss). Keep the two equal.
 * - `retry: false` for **all mutations** is the write-safety default: a failed
 *   `POST /timers` must never be auto-replayed (double-start). Reads retry
 *   transient failures only.
 * - `networkMode: "offlineFirst"`: serve persisted weeks while offline.
 */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: PERSIST_MAX_AGE,
        retry: (failureCount, error) => failureCount < 2 && isRetriableRead(error),
        refetchOnWindowFocus: false,
        networkMode: "offlineFirst",
      },
      mutations: {
        retry: false,
      },
    },
  });
}
