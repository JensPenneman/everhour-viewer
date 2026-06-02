/**
 * App-owned localStorage keys.
 *
 * The cached profile + weeks now live in the persisted TanStack Query blob
 * (see `lib/query/persister.ts`), not here. These two keys are the remaining
 * stores whose source of truth is their own localStorage entry: the API key
 * and the manual day-events. The `v1` suffix keeps an explicit upgrade path.
 */
export const STORAGE_KEYS = {
  apiKey: "everhour_api_key",
  dayEvents: "everhour_viewer_day_events_v1",
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
