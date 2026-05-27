/**
 * Day-level overlay events that sit alongside Everhour timesheet data.
 *
 * Everhour only knows about time that was tracked. Days that are paid
 * leave, public holidays, sick days, etc. don't show up there — they
 * appear as blanks. This module introduces a generic `DayEvent` shape
 * that the UI overlays on top of the per-day chart and breakdown.
 *
 * Events have a `source` so the UI can distinguish:
 *   - `manual`        — user-created in this browser (editable),
 *   - `holidays:<cc>` — public holidays from the date-holidays library,
 *   - future          — third-party providers (`officient`, `ms365`,
 *                       `linear`, …) once the provider abstraction lands.
 */

export type DayEventKind = "holiday" | "leave" | "sick" | "office_closed" | "other";

export type DayEventSource = "manual" | `holidays:${string}` | string;

export interface DayEvent {
  /** Stable identifier; deterministic for static sources, random for manual. */
  readonly id: string;
  /** ISO date `YYYY-MM-DD` of the day this event applies to. */
  readonly date: string;
  readonly kind: DayEventKind;
  readonly source: DayEventSource;
  /** Locale-aware display label, e.g. "Hemelvaart" / "Verlof". */
  readonly label: string;
  /** Optional free-form note. */
  readonly description?: string;
  /**
   * Optional "this day counts as N hours" — useful when paid leave maps
   * to a standard work day. Not currently used in totals; reserved.
   */
  readonly hours?: number;
}
