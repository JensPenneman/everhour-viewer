/**
 * Day / week time targets for the live "Vandaag" view.
 *
 * Fixed defaults — a full day is 8u, a full week 40u — matching the stated
 * goal ("until a full day" / "the full 40h"). Kept here as the single source
 * of truth so they're trivial to change (or wire to `profile.capacity` later;
 * its unit is unreliable in practice, so we don't depend on it).
 */

export const DAY_TARGET_SECONDS = 8 * 3600;
export const WEEK_TARGET_SECONDS = 40 * 3600;

export interface TargetProgress {
  readonly trackedSec: number;
  readonly targetSec: number;
  /** Seconds still needed to reach the target (0 once reached). */
  readonly remainingSec: number;
  /** Seconds tracked beyond the target (0 until exceeded). */
  readonly overSec: number;
  readonly reached: boolean;
  /** Progress 0–100, capped at 100. */
  readonly pct: number;
}

/** Compute remaining / overtime / progress for a tracked total against a target. */
export function targetProgress(trackedSec: number, targetSec: number): TargetProgress {
  const tracked = Math.max(0, trackedSec);
  return {
    trackedSec: tracked,
    targetSec,
    remainingSec: Math.max(0, targetSec - tracked),
    overSec: Math.max(0, tracked - targetSec),
    reached: tracked >= targetSec,
    pct: targetSec > 0 ? Math.min(100, Math.round((tracked / targetSec) * 100)) : 0,
  };
}
