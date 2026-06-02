/**
 * Helpers for narrowing the `unknown` value that `catch` hands us.
 *
 * `catch (e: unknown)` is unavoidable, but the value should be narrowed at
 * once rather than cast around. Both server error responses and
 * {@link import("./everhour").EverhourError} carry a numeric `status`; the
 * live mutations branch on it (e.g. a 4xx clock error → "controls
 * unavailable"), and toasts need a readable message for any thrown value.
 */

export interface ErrorWithStatus extends Error {
  readonly status?: number;
}

/** True for any `Error` instance (the common, narrowable case). */
export function isError(e: unknown): e is Error {
  return e instanceof Error;
}

/** Best-effort human-readable message for any thrown value. */
export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return String(e);
}

/** The HTTP-ish status carried by a thrown value, if any. */
export function errorStatus(e: unknown): number | undefined {
  if (typeof e === "object" && e !== null && "status" in e) {
    const status = e.status;
    return typeof status === "number" ? status : undefined;
  }
  return undefined;
}
