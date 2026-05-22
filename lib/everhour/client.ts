import { EverhourError } from "./errors";

const API_BASE = "https://api.everhour.com";

const DEFAULT_RETRY_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY_MS = 400;

export interface FetchOptions {
  readonly key: string;
  readonly params?: Readonly<Record<string, string | number>>;
  readonly signal?: AbortSignal;
  readonly retries?: number;
}

/**
 * Low-level GET against the Everhour REST API.
 *
 * - Retries transient failures (network, 429, 5xx) with linear back-off.
 * - Surfaces 4xx errors immediately as {@link EverhourError} so callers can
 *   branch on auth/quota errors without paying for retries.
 *
 * Callers should layer their own domain operations on top of this rather
 * than calling it directly from UI code — see `lib/everhour/api.ts`.
 */
export async function everhourFetch<T>(path: string, opts: FetchOptions): Promise<T> {
  const url = new URL(API_BASE + path);
  if (opts.params) {
    for (const [k, v] of Object.entries(opts.params)) {
      url.searchParams.set(k, String(v));
    }
  }

  const attempts = opts.retries ?? DEFAULT_RETRY_ATTEMPTS;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) {
      await delay(DEFAULT_RETRY_DELAY_MS * attempt, opts.signal);
    }

    try {
      const resp = await fetch(url, {
        headers: { "X-Api-Key": opts.key },
        cache: "no-store",
        signal: opts.signal,
      });

      if (resp.ok) {
        return (await resp.json()) as T;
      }

      const body = await resp.text().catch(() => "");
      const err = new EverhourError(
        resp.status,
        `Everhour ${resp.status} on ${path}${body ? `: ${body.slice(0, 200)}` : ""}`,
      );

      if (!err.isRetryable()) throw err;
      lastError = err;
    } catch (e) {
      if (e instanceof EverhourError) {
        if (!e.isRetryable()) throw e;
        lastError = e;
        continue;
      }
      // AbortError or network-level failure (DNS, TCP, TLS, etc.)
      if (isAbortError(e)) throw e;
      lastError = e;
    }
  }

  if (lastError instanceof EverhourError) throw lastError;
  const msg = lastError instanceof Error ? lastError.message : String(lastError);
  throw new EverhourError(0, `Network error on ${path}: ${msg}`, { cause: lastError });
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

function isAbortError(e: unknown): boolean {
  return e instanceof Error && (e.name === "AbortError" || e.name === "TimeoutError");
}
