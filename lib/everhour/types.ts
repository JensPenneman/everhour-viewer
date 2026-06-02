/**
 * Domain types for the Everhour viewer.
 *
 * These types are the canonical shape of data both at rest (in
 * `localStorage` / on-disk backups) and over the wire (NDJSON sync events).
 * They are intentionally narrower than Everhour's own API payloads — the
 * server sanitises into these shapes before sending them to the client.
 */

import type { JsonValue } from "@/lib/json";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "unsubmitted";

/**
 * Current {@link WeekRecord} schema version.
 *
 * Bumped from 2 → 3 when per-entry edit history (`comment` + `history`) and
 * timecard clock history were added. The delta-sync plan refetches any
 * cached week whose `schemaVersion` is below this, so older caches heal on
 * the next sync without a manual force.
 */
export const WEEK_SCHEMA_VERSION = 3 as const;

export interface EverhourProfile {
  readonly schemaVersion: 1;
  readonly exportedAt: string;
  readonly id: number;
  readonly name: string;
  readonly email: string;
  readonly role: string | null;
  readonly headline: string | null;
  readonly status: string | null;
  readonly avatarUrl: string | null;
  readonly avatarUrlLarge: string | null;
  readonly timezone: number | null;
  readonly capacity: number | null;
  readonly cost: number | null;
  /** Opaque Everhour cost-history blob — stored/round-tripped, never read. */
  readonly costHistory: JsonValue | null;
  readonly createdAt: string | null;
  readonly groups: ReadonlyArray<{ readonly id: number; readonly name: string }> | null;
}

export interface WeekTaskRef {
  readonly id: string;
  readonly name: string;
  readonly linearKey: string | null;
  readonly url: string | null;
  readonly labels: ReadonlyArray<string>;
}

/** A single record in a time entry's audit trail. */
export type TimeEditAction = "TIMER" | "EDIT" | "COMMENT";

/**
 * One change to a time entry, sanitised from Everhour's `history` array.
 *
 * `deltaSeconds` is signed: a running timer adds positive seconds, a manual
 * correction can be negative (the boss removing 27 min of lunch is -1620).
 * `previousSeconds` is the cumulative total *before* this action, so the
 * resulting total is always `previousSeconds + deltaSeconds`.
 *
 * `at` is the raw UTC timestamp Everhour returned (`YYYY-MM-DD HH:MM:SS`);
 * the UI converts it to local time using the profile timezone offset. `by`
 * is the actor's user id and `byName` its resolved display name (null when
 * the actor is no longer on the team).
 */
export interface TimeEdit {
  readonly action: TimeEditAction;
  readonly deltaSeconds: number;
  readonly previousSeconds: number;
  readonly at: string;
  readonly by: number | null;
  readonly byName: string | null;
  /** Set when the action moved time off another task (Everhour `previousTask`). */
  readonly fromTaskId: string | null;
  /** Set when the action moved time off another date (Everhour `previousDate`). */
  readonly fromDate: string | null;
  readonly warning: string | null;
}

export interface WeekEntry {
  readonly task: WeekTaskRef;
  readonly seconds: number;
  readonly lockReasons: ReadonlyArray<string>;
  /** Everhour time-record id; stable key for an entry within a day. */
  readonly entryId?: number | null;
  /** Latest comment on the record (e.g. "Correctie lunch"), or null. */
  readonly comment?: string | null;
  /** Audit trail of timer runs, manual edits, and comments. Newest last. */
  readonly history?: ReadonlyArray<TimeEdit>;
}

/** One clock-in / clock-out event from a day's timecard history. */
export interface ClockEvent {
  /** "clock-in" | "clock-out". */
  readonly action: string;
  /** What caused it: "timer", "day-end" (auto), "manual", … */
  readonly trigger: string;
  /** Raw UTC timestamp (`YYYY-MM-DD HH:MM:SS`). */
  readonly at: string;
  /** Local clock value Everhour recorded, e.g. "9:09". */
  readonly localTime: string | null;
  readonly by: number | null;
  readonly byName: string | null;
}

export interface WeekDay {
  readonly date: string;
  readonly weekday: string;
  readonly totalSeconds: number;
  readonly entries: ReadonlyArray<WeekEntry>;
  readonly clockIn?: string | null;
  readonly clockOut?: string | null;
  readonly workTime?: number | null;
  readonly breakTime?: number | null;
  /** Clock-in/out audit trail for the day. */
  readonly clockHistory?: ReadonlyArray<ClockEvent>;
}

export interface ApprovalEvent {
  readonly action: string;
  readonly createdAt: string;
}

export interface WeekRecord {
  readonly schemaVersion: typeof WEEK_SCHEMA_VERSION;
  readonly exportedAt: string;
  readonly user: { readonly id: number; readonly name: string; readonly email: string };
  readonly week: {
    readonly isoWeek: string;
    readonly weekId: number;
    readonly from: string;
    readonly to: string;
  };
  readonly approval: {
    readonly status: ApprovalStatus;
    readonly submittedAt: string | null;
    readonly history: ReadonlyArray<ApprovalEvent>;
  };
  readonly totals: { readonly seconds: number; readonly hours: number };
  readonly days: ReadonlyArray<WeekDay>;
}

/** Backup file written by the in-browser "Backup downloaden" action. */
export interface BackupFile {
  readonly schemaVersion: 1;
  readonly exportedAt: string;
  readonly profile: EverhourProfile | null;
  readonly weeks: ReadonlyArray<WeekRecord>;
  readonly index: ReadonlyArray<{
    readonly isoWeek: string;
    readonly weekId: number;
    readonly from: string;
    readonly to: string;
    readonly hours: number;
    readonly status: ApprovalStatus;
    readonly submittedAt: string | null;
  }>;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Raw Everhour API shapes — only consumed by lib/everhour/transforms.ts.   */
/* Kept here so the surface is documented; not re-exported.                 */
/* ────────────────────────────────────────────────────────────────────────── */

export interface RawTask {
  readonly id: string;
  readonly name: string;
  readonly number?: string | null;
  readonly url?: string | null;
  readonly labels?: ReadonlyArray<string>;
}

export interface RawEntryHistory {
  readonly id?: number;
  readonly action?: string;
  readonly time?: number;
  readonly previousTime?: number;
  readonly previousTask?: string | null;
  readonly previousDate?: string | null;
  readonly createdBy?: number | null;
  readonly createdAt?: string;
  readonly warning?: string | null;
}

export interface RawEntry {
  readonly id?: number;
  readonly date: string;
  readonly time: number;
  readonly task: RawTask;
  readonly comment?: string | null;
  readonly createdAt?: string;
  readonly history?: ReadonlyArray<RawEntryHistory>;
  readonly lockReasons?: ReadonlyArray<string>;
}

export interface RawTimecardHistory {
  readonly action?: string;
  readonly trigger?: string;
  readonly createdBy?: number | null;
  readonly createdAt?: string;
  readonly time?: string | null;
}

export interface RawTimecard {
  readonly date: string;
  readonly clockIn?: string | null;
  readonly clockOut?: string | null;
  readonly workTime?: number | null;
  readonly breakTime?: number | null;
  readonly history?: ReadonlyArray<RawTimecardHistory>;
}

export interface RawTimesheet {
  readonly user: { readonly id: number; readonly name: string; readonly email: string };
  readonly week: { readonly id: number; readonly from: string; readonly to: string };
  readonly dailyTime?: Readonly<Record<string, number>>;
  readonly timecards?: ReadonlyArray<RawTimecard>;
  readonly approval?: {
    readonly status: ApprovalStatus;
    readonly history?: ReadonlyArray<ApprovalEvent>;
  };
}

/** A single member from `/team/users`, narrowed to what we display. */
export interface RawTeamMember {
  readonly id: number;
  readonly name?: string | null;
  readonly email?: string | null;
}

/** Resolved id → display name for actors in edit/clock history. */
export type MemberMap = ReadonlyMap<number, string>;

/* ────────────────────────────────────────────────────────────────────────── */
/* Live tracking — the active-use ("Vandaag") surface.                       */
/* ────────────────────────────────────────────────────────────────────────── */

/** A task a timer can run on (search hit, or the running timer's task). */
export interface TaskHit {
  readonly id: string;
  readonly name: string;
  /** Everhour `task.number`, e.g. a Linear key "LS-510". */
  readonly linearKey: string | null;
  readonly url: string | null;
  readonly status: string | null;
}

/**
 * The current timer, sanitised from `/timers/current`.
 *
 * `running` is false when no timer is active. `durationSeconds` is the
 * server-reported elapsed at fetch time; the UI ticks locally on top of it.
 * `startedAt` is the raw UTC timestamp (`YYYY-MM-DD HH:MM:SS`).
 */
export interface Timer {
  readonly running: boolean;
  readonly durationSeconds: number;
  readonly startedAt: string | null;
  readonly task: TaskHit | null;
}

/** Today's attendance clock, sanitised from `/timecards`. */
export interface ClockStatus {
  readonly date: string;
  readonly clockedIn: boolean;
  /** Local `"HH:MM"` of clock-in, or null if not clocked in today. */
  readonly clockIn: string | null;
  /** Local `"HH:MM"` of clock-out, or null while still clocked in. */
  readonly clockOut: string | null;
}

/** One committed time entry, trimmed for the live day/week totals. */
export interface LiveEntry {
  readonly date: string;
  readonly seconds: number;
  readonly task: TaskHit;
}
