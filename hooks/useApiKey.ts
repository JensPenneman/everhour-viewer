"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { STORAGE_KEYS } from "@/lib/storage";
import { readApiKey, writeApiKey } from "@/lib/storage";

export interface ApiKeyApi {
  /** True when a user-supplied key is set in this browser. */
  readonly hasUserKey: boolean;
  /** True when the server reports it has an `EVERHOUR_API_KEY` env fallback. */
  readonly hasEnvKey: boolean | null;
  /** True if a sync can run with the current configuration (env or user). */
  readonly canSync: boolean;
  /** Persist (or clear, if empty) the user-supplied key. */
  readonly setUserKey: (value: string) => void;
  /** Snapshot the current user-supplied key from localStorage (for sending in headers). */
  readonly readUserKey: () => string | null;
}

/**
 * Reactive wrapper around the API key storage + the `/api/sync` capability
 * probe.
 *
 * Uses `useSyncExternalStore` for the localStorage read so the value is
 * computed on first render without scheduling an effect that updates
 * state. This both removes a render and stays compatible with React's
 * cross-tab `storage` event for free.
 *
 * The env-key probe (network call) lives in a `useEffect` because we
 * deliberately want it to settle after first paint.
 */
export function useApiKey(): ApiKeyApi {
  const hasUserKey = useSyncExternalStore(
    subscribeToStorage,
    () => !!readApiKey(),
    () => false, // SSR snapshot: pretend the key isn't set
  );

  const [hasEnvKey, setHasEnvKey] = useState<boolean | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/sync", { signal: controller.signal })
      .then((r) => r.json() as Promise<{ hasEnvKey: boolean }>)
      .then((d) => setHasEnvKey(d.hasEnvKey))
      .catch(() => {
        if (!controller.signal.aborted) setHasEnvKey(false);
      });
    return () => controller.abort();
  }, []);

  const setUserKey = useCallback((value: string) => {
    writeApiKey(value);
    // useSyncExternalStore subscribers are notified by the `storage` event,
    // which doesn't fire for changes in the *same* tab. Dispatch one so
    // any in-tab subscribers refresh.
    if (typeof window !== "undefined") {
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEYS.apiKey }));
    }
  }, []);

  const readUserKey = useCallback(() => readApiKey(), []);

  return {
    hasUserKey,
    hasEnvKey,
    canSync: hasUserKey || hasEnvKey === true,
    setUserKey,
    readUserKey,
  };
}

function subscribeToStorage(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const handler = (e: StorageEvent) => {
    if (e.key === null || e.key === STORAGE_KEYS.apiKey) onChange();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}
