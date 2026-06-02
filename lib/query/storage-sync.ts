"use client";

import { useEffect } from "react";
import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { STORAGE_KEYS } from "@/lib/storage";
import { authKeys, eventKeys, liveKeys, syncKeys } from "./keys";

/** Refetch every server-backed query — e.g. after the API key changes. */
export function invalidateServerQueries(client: QueryClient): void {
  void client.invalidateQueries({ queryKey: liveKeys.all });
  void client.invalidateQueries({ queryKey: syncKeys.capability() });
}

/**
 * Bridge the native `storage` event into query invalidation.
 *
 * localStorage-backed queries (the API key, manual day-events) are the source
 * of truth in their own keys, not in the persisted query blob. A single
 * listener mounted once keeps every tab — and same-tab writers that dispatch a
 * synthetic `StorageEvent` — coherent, replacing the per-hook
 * `useSyncExternalStore` plumbing. A key change also refetches all server
 * queries, since the credential they authenticate with may have changed.
 */
export function useStorageSync(): void {
  const client = useQueryClient();
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === STORAGE_KEYS.apiKey) {
        void client.invalidateQueries({ queryKey: authKeys.apiKey() });
        invalidateServerQueries(client);
      }
      if (e.key === null || e.key === STORAGE_KEYS.dayEvents) {
        void client.invalidateQueries({ queryKey: eventKeys.manual() });
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [client]);
}
