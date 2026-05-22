/**
 * All localStorage keys live here.
 *
 * The `v1` suffix gives us an explicit upgrade path: if a future cache
 * schema is incompatible we can introduce `v2` and ignore (or migrate)
 * `v1` rather than try to detect drift inside the reader.
 */
export const STORAGE_KEYS = {
  cache: "everhour_viewer_data_v1",
  apiKey: "everhour_api_key",
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
