import type { EverhourProfile, WeekRecord } from "@/lib/everhour";
import { STORAGE_KEYS } from "./keys";

export interface CacheSnapshot {
  readonly profile: EverhourProfile | null;
  readonly weeks: ReadonlyArray<WeekRecord>;
}

/**
 * Read the cached profile + weeks from `localStorage`.
 *
 * Returns `null` if there's no cache, the JSON is corrupt, or the data
 * doesn't match the expected shape — the caller treats any of those the
 * same way (start from empty state). Errors are intentionally swallowed:
 * a broken cache shouldn't crash the app on load.
 *
 * SSR-safe: returns `null` when `window` is unavailable.
 */
export function readCache(): CacheSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.cache);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CacheSnapshot>;
    return {
      profile: parsed.profile ?? null,
      weeks: Array.isArray(parsed.weeks) ? parsed.weeks : [],
    };
  } catch {
    return null;
  }
}

/**
 * Persist a cache snapshot. Failures (quota exceeded, private-browsing) are
 * surfaced via the return boolean so the caller can decide whether to warn
 * the user — most callers don't, because the in-memory state is still good.
 */
export function writeCache(snapshot: CacheSnapshot): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(STORAGE_KEYS.cache, JSON.stringify(snapshot));
    return true;
  } catch {
    return false;
  }
}

export function clearCache(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEYS.cache);
}
