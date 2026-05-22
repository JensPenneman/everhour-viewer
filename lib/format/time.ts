/**
 * Format a count of seconds as a fixed-decimal hour string.
 *
 * Always returns 2 decimals; `8.20` rather than `8.2` so columns stay
 * visually aligned in tabular numerics. No unit suffix is appended;
 * callers compose `${fmtHours(s)}u` themselves when an `u` is needed.
 */
export function fmtHours(seconds: number): string {
  return (seconds / 3600).toFixed(2);
}

/** Sum a list of seconds and return total hours as a number (rounded to 0.01). */
export function totalHours(seconds: ReadonlyArray<number>): number {
  const sum = seconds.reduce((a, b) => a + b, 0);
  return Math.round((sum / 3600) * 100) / 100;
}
