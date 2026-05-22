/**
 * Domain error for any failure communicating with Everhour.
 *
 * `status` carries the HTTP status when available (0 for network-level
 * failures so callers can branch on "no response received" vs "non-2xx").
 */
export class EverhourError extends Error {
  override readonly name = "EverhourError";
  readonly status: number;

  constructor(status: number, message: string, options?: ErrorOptions) {
    super(message, options);
    this.status = status;
  }

  /** True when retrying is reasonable: network failures, rate limits, 5xx. */
  isRetryable(): boolean {
    return this.status === 0 || this.status === 429 || this.status >= 500;
  }
}
