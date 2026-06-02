import type { JsonValue } from "@/lib/json";

export interface LiveFetchInit {
  readonly method?: string;
  readonly body?: JsonValue;
  readonly signal?: AbortSignal;
}

/**
 * Fetch a live API route, attaching the user key as the `x-everhour-key`
 * header when present (the server falls back to its env key otherwise).
 *
 * The key is passed in explicitly rather than read from storage so the caller
 * controls it; it is never part of a query key. On a non-2xx response the
 * server's `{ error }` body is surfaced as the message and the HTTP status is
 * attached so callers (and the retry policy) can branch on it.
 */
export async function liveFetch<T>(
  path: string,
  apiKey: string | null,
  init?: LiveFetchInit,
): Promise<T> {
  const resp = await fetch(path, {
    method: init?.method ?? "GET",
    headers: {
      ...(apiKey ? { "x-everhour-key": apiKey } : {}),
      ...(init?.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    signal: init?.signal,
  });

  if (!resp.ok) {
    let message = `HTTP ${resp.status}`;
    try {
      const j = (await resp.json()) as { error?: string };
      if (j?.error) message = j.error;
    } catch {
      /* ignore non-JSON error bodies */
    }
    const err = new Error(message) as Error & { status?: number };
    err.status = resp.status;
    throw err;
  }

  if (resp.status === 204) return undefined as T;
  const text = await resp.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
