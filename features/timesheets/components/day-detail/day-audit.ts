import type { TimeEdit, WeekDay, WeekEntry } from "@/lib/everhour";
import { localMinutesOfDay } from "@/lib/format";

/**
 * Pure, framework-agnostic derivations for the daily-detail view.
 *
 * Everything the "Dagdetail" screen shows is computed here from a
 * {@link WeekDay} so the React components stay dumb and this logic is unit
 * tested in isolation (`tests/unit/viewer/day-audit.test.ts`).
 *
 * Two honesty invariants are encoded here, not in the UI:
 *   1. A change is **foreign** (someone other than the timesheet owner) iff
 *      its actor id is not the owner's. A missing actor id fails *toward*
 *      foreign — we'd rather over-flag than hide a boss edit.
 *   2. Cumulative time always comes from `previousSeconds + deltaSeconds`,
 *      never a naive re-sum — time moved in from another task breaks sums.
 */

/** Gap (seconds) between tracked segments below which we don't call it a break. */
export const GAP_THRESHOLD_SEC = 480; // 8 minutes

/** A correction/comment surfaced in the "Wat is gewijzigd" feed. */
export interface ChangeRow {
  readonly entry: WeekEntry;
  readonly edit: TimeEdit;
  /** Cumulative seconds on the entry after this action. */
  readonly newSeconds: number;
  /** True when the actor is not the timesheet owner (incl. unknown actors). */
  readonly isForeign: boolean;
  /** Display name: resolved name when foreign, else "Jij". */
  readonly actorLabel: string;
  /** Latest comment on the entry (may explain the change), or null. */
  readonly comment: string | null;
}

/** A change is foreign when it was not definitively made by the owner. */
export function isForeignActor(by: number | null, ownerId: number): boolean {
  return by !== ownerId;
}

/** Net seconds added/removed by manual EDIT actions on an entry (signed). */
export function entryNetEditSeconds(entry: WeekEntry): number {
  return (entry.history ?? [])
    .filter((h) => h.action === "EDIT")
    .reduce((acc, h) => acc + h.deltaSeconds, 0);
}

/**
 * Net seconds changed by EDITs from someone *other* than the owner (signed).
 *
 * This — not {@link entryNetEditSeconds} — drives the red/amber tone, so the
 * owner correcting their own timer never colours the row as a foreign
 * intervention. Red is reserved for a foreign reduction (`< 0`).
 */
export function foreignNetEditSeconds(entry: WeekEntry, ownerId: number): number {
  return (entry.history ?? [])
    .filter((h) => h.action === "EDIT" && isForeignActor(h.by, ownerId))
    .reduce((acc, h) => acc + h.deltaSeconds, 0);
}

/** Display label for an actor: resolved name, else "Gebruiker #id", else generic. */
export function resolveActorLabel(byName: string | null, by: number | null): string {
  if (byName) return byName;
  return by != null ? `Gebruiker #${by}` : "Onbekende gebruiker";
}

/** True when any EDIT/COMMENT on the entry was made by someone other than the owner. */
export function entryWasCorrectedByOther(entry: WeekEntry, ownerId: number): boolean {
  return (entry.history ?? []).some(
    (h) => (h.action === "EDIT" || h.action === "COMMENT") && isForeignActor(h.by, ownerId),
  );
}

/**
 * Build the "Wat is gewijzigd" feed: every manual EDIT, plus standalone
 * COMMENT actions (a comment that doesn't merely accompany an edit by the
 * same actor — those are already shown on the edit row). Newest first.
 */
export function buildChangeLog(day: WeekDay, ownerId: number): ReadonlyArray<ChangeRow> {
  const rows: ChangeRow[] = [];

  for (const entry of day.entries) {
    const history = entry.history ?? [];
    const edits = history.filter((h) => h.action === "EDIT");
    const comments = history.filter((h) => h.action === "COMMENT");

    for (const edit of edits) rows.push(makeRow(entry, edit, ownerId));

    for (const c of comments) {
      // A comment alongside an edit by the same *identified* actor is shown
      // on the edit row; only surface a comment row when it stands alone
      // (e.g. a boss who commented without changing time). Unknown actors
      // (by === null) are never folded — `null === null` would wrongly merge
      // two unrelated integration/ex-user records.
      if (c.by != null && edits.some((e) => e.by === c.by)) continue;
      rows.push(makeRow(entry, c, ownerId));
    }
  }

  // Newest first; stable for equal timestamps.
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => b.r.edit.at.localeCompare(a.r.edit.at) || a.i - b.i)
    .map(({ r }) => r);
}

function makeRow(entry: WeekEntry, edit: TimeEdit, ownerId: number): ChangeRow {
  const isForeign = isForeignActor(edit.by, ownerId);
  return {
    entry,
    edit,
    newSeconds: edit.previousSeconds + edit.deltaSeconds,
    isForeign,
    actorLabel: isForeign ? resolveActorLabel(edit.byName, edit.by) : "Jij",
    comment: entry.comment ?? null,
  };
}

/** Count of foreign corrections to headline at the top of the day. */
export function foreignCorrectionCount(changeLog: ReadonlyArray<ChangeRow>): number {
  return changeLog.filter((r) => r.isForeign).length;
}

export interface DayBreaks {
  /** Attendance span in seconds (clock-out − clock-in, or workTime), or null. */
  readonly attendanceSec: number | null;
  /** Sum of tracked time across all entries. */
  readonly trackedSec: number;
  /** Inferred break = max(0, attendance − tracked); null when not derivable. */
  readonly breakSec: number | null;
  readonly hasClockOut: boolean;
  /** True when the clock-out was the automatic end-of-day close. */
  readonly autoClosed: boolean;
  /** True when more time was tracked than the attendance span. */
  readonly overTracked: boolean;
}

/** Derive the attendance / tracked / inferred-break figures for a day. */
export function dayBreaks(day: WeekDay): DayBreaks {
  const trackedSec = day.entries.reduce((acc, e) => acc + e.seconds, 0);
  const hasClockOut = day.clockOut != null && day.clockOut !== "";

  const inMin = parseClock(day.clockIn);
  const outMin = parseClock(day.clockOut);
  // clockIn/clockOut are dateless local "HH:MM"; an overnight shift (out <
  // in) crosses midnight, so add a day rather than reporting a negative span.
  let spanSec: number | null = null;
  if (inMin != null && outMin != null) {
    const minutes = outMin >= inMin ? outMin - inMin : outMin - inMin + 24 * 60;
    spanSec = minutes * 60;
  }
  const attendanceSec = day.workTime ?? spanSec;

  const autoClosed = (day.clockHistory ?? []).some(
    (c) => c.action.includes("out") && c.trigger === "day-end",
  );

  // A break / over-tracking is only meaningful once the day has a closing
  // boundary — otherwise an in-progress day reads "dag nog bezig".
  const breakSec =
    hasClockOut && attendanceSec != null ? Math.max(0, attendanceSec - trackedSec) : null;
  const overTracked = hasClockOut && attendanceSec != null && trackedSec > attendanceSec;

  return { attendanceSec, trackedSec, breakSec, hasClockOut, autoClosed, overTracked };
}

export interface TimelineInterval {
  readonly startMin: number;
  readonly endMin: number;
}

export interface DayTimeline {
  readonly domainStartMin: number;
  readonly domainEndMin: number;
  /** Merged tracked intervals (local minutes-of-day). */
  readonly segments: ReadonlyArray<TimelineInterval>;
  /** Gaps ≥ {@link GAP_THRESHOLD_SEC} between tracked intervals. */
  readonly gaps: ReadonlyArray<TimelineInterval>;
  readonly hasData: boolean;
  /** False when the profile timezone is unknown (times shown in UTC). */
  readonly tzKnown: boolean;
}

/**
 * Reconstruct an *approximate* intraday timeline from TIMER history.
 *
 * Each timer record's `at` is when a chunk was saved (UTC); we place the
 * chunk as `[save − duration, save]` in local minutes and merge overlaps.
 * These are save-moments, not exact start/stops — the caller must label the
 * result as approximate. Gaps wider than the threshold are candidate breaks.
 */
export function buildTimeline(day: WeekDay, tzOffsetHours: number | null): DayTimeline {
  const tzKnown = tzOffsetHours != null;
  const raw: TimelineInterval[] = [];

  for (const entry of day.entries) {
    for (const h of entry.history ?? []) {
      if (h.action !== "TIMER" || h.deltaSeconds <= 0) continue;
      const saveMin = localMinutesOfDay(h.at, tzOffsetHours);
      if (saveMin == null) continue;
      const startMin = saveMin - h.deltaSeconds / 60;
      raw.push({ startMin: Math.min(startMin, saveMin), endMin: saveMin });
    }
  }

  const clockInMin = parseClock(day.clockIn);
  const clockOutMin = parseClock(day.clockOut);

  // Domain: prefer the attendance window; fall back to the span of tracked
  // chunks when there's no timecard.
  const segMin = raw.length ? Math.min(...raw.map((s) => s.startMin)) : null;
  const segMax = raw.length ? Math.max(...raw.map((s) => s.endMin)) : null;
  const domainStartMin = clockInMin ?? segMin ?? 0;
  const domainEndMin = Math.max(clockOutMin ?? segMax ?? domainStartMin, domainStartMin + 1);

  // Clamp + merge overlapping intervals.
  const clamped = raw
    .map((s) => ({
      startMin: Math.max(domainStartMin, Math.min(s.startMin, domainEndMin)),
      endMin: Math.max(domainStartMin, Math.min(s.endMin, domainEndMin)),
    }))
    .filter((s) => s.endMin > s.startMin)
    .sort((a, b) => a.startMin - b.startMin);

  const segments: TimelineInterval[] = [];
  for (const s of clamped) {
    const last = segments[segments.length - 1];
    if (last && s.startMin <= last.endMin) {
      if (s.endMin > last.endMin) segments[segments.length - 1] = { ...last, endMin: s.endMin };
    } else {
      segments.push({ ...s });
    }
  }

  const gaps: TimelineInterval[] = [];
  const gapThresholdMin = GAP_THRESHOLD_SEC / 60;
  for (let i = 0; i < segments.length - 1; i++) {
    const gapStart = segments[i]!.endMin;
    const gapEnd = segments[i + 1]!.startMin;
    if (gapEnd - gapStart >= gapThresholdMin) gaps.push({ startMin: gapStart, endMin: gapEnd });
  }

  return {
    domainStartMin,
    domainEndMin,
    segments,
    gaps,
    hasData: segments.length > 0,
    tzKnown,
  };
}

/** Parse a local `"HH:MM"` clock string into minutes-since-midnight. */
function parseClock(hhmm: string | null | undefined): number | null {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  return +m[1]! * 60 + +m[2]!;
}
