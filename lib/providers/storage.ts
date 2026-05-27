/**
 * Per-provider local storage namespace.
 *
 * Each provider lives under its own key so we can wipe a single
 * integration without touching neighbours, and so the storage layout
 * survives adding/removing providers without coordination.
 */
export function providerStorageKey(providerId: string, slot: string): string {
  const sanitised = `${providerId}_${slot}`.replace(/[^a-zA-Z0-9_]/g, "_");
  return `everhour_viewer_provider_${sanitised}_v1`;
}

export function readProviderJson<T>(providerId: string, slot: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(providerStorageKey(providerId, slot));
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeProviderJson<T>(providerId: string, slot: string, value: T): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(providerStorageKey(providerId, slot), JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function clearProviderStorage(providerId: string, slot: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(providerStorageKey(providerId, slot));
}
