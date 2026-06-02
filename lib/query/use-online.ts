"use client";

import { useSyncExternalStore } from "react";
import { onlineManager } from "@tanstack/react-query";

/**
 * Online/offline state, sourced from TanStack Query's `onlineManager` (which
 * already tracks `navigator.onLine` + the `online`/`offline` events across
 * browsers) — so the UI and the query cache agree on connectivity.
 */
export function useOnline(): boolean {
  return useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    () => onlineManager.isOnline(),
    () => true, // assume online during SSR / before hydration
  );
}
