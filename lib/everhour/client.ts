import type { JsonValue } from "@/lib/json";
import { EverhourError } from "./errors";

const API_BASE = "https://api.everhour.com";

const DEFAULT_RETRY_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY_MS = 400;

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export interface FetchOptions {
  readonly key: string;
  readonly method?: HttpMethod;
  /** JSON request body for write methods. */
  readonly body?: JsonValue;
  readonly params?: Readonly<Record<string, string | number>>;
  readonly signal?: AbortSignal;
  readonly retries?: number;
}

/**
 * Low-level request against the Everhour REST API.
 *
 * - **GET** retries transient failures (network, 429, 5xx) with linear
 *   back-off, since reads are idempotent.
 * - **Writes** (POST/PUT/DELETE) default to a **single attempt** — retrying a
 *   `POST /timers` could double-start a timer — and surface the failure
 *   instead. Pass `retries` explicitly to override either default.
 * - 4xx errors surface immediately as {@link EverhourError} so callers can
 *   branch on auth/quota errors.
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

  const method = opts.method ?? "GET";
  const isWrite = method !== "GET";
  const attempts = opts.retries ?? (isWrite ? 1 : DEFAULT_RETRY_ATTEMPTS);
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) {
      await delay(DEFAULT_RETRY_DELAY_MS * attempt, opts.signal);
    }

    try {
      const resp = await fetch(url, {
        method,
        headers: {
          "X-Api-Key": opts.key,
          ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        cache: "no-store",
        signal: opts.signal,
      });

      if (resp.ok) {
        // Some writes (e.g. DELETE) return 204 / an empty body.
        if (resp.status === 204) return undefined as T;
        const text = await resp.text();
        return (text ? JSON.parse(text) : undefined) as T;
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
