import { STORAGE_KEYS } from "./keys";

/** Browser-side API key read. SSR-safe (returns null). */
export function readApiKey(): string | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(STORAGE_KEYS.apiKey);
  return v && v.trim() ? v.trim() : null;
}

/** Persist (or clear, if empty) the API key. */
export function writeApiKey(value: string): void {
  if (typeof window === "undefined") return;
  const trimmed = value.trim();
  if (trimmed) window.localStorage.setItem(STORAGE_KEYS.apiKey, trimmed);
  else window.localStorage.removeItem(STORAGE_KEYS.apiKey);
}
