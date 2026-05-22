/**
 * Wire format for the streaming /api/sync endpoint.
 *
 * The server emits a sequence of NDJSON events. Order:
 *
 *   1. `profile`   — once, immediately after the API key is validated.
 *   2. `plan`      — once, after the timesheet list is fetched. Tells the
 *                    client how many weeks will be fetched vs. skipped, so
 *                    the progress bar can switch from indeterminate to
 *                    deterministic.
 *   3. `skip`*     — zero or more, one per submitted-and-already-cached week.
 *   4. `week`*     — zero or more, in chronological order.
 *   5. `done` | `error` — exactly one; terminates the stream.
 *
 * The `error` event is also emitted mid-stream if the upstream Everhour
 * API fails after some weeks have already streamed: any data already sent
 * is valid; the client merges what it received and surfaces the error.
 */

import type { EverhourProfile, WeekRecord } from "@/lib/everhour";

export type SyncEvent = ProfileEvent | PlanEvent | SkipEvent | WeekEvent | DoneEvent | ErrorEvent;

export interface ProfileEvent {
  readonly type: "profile";
  readonly profile: EverhourProfile;
}

export interface PlanEvent {
  readonly type: "plan";
  readonly total: number;
  readonly toFetch: number;
  readonly toSkip: number;
}

export interface SkipEvent {
  readonly type: "skip";
  readonly isoWeek: string;
}

export interface WeekEvent {
  readonly type: "week";
  readonly week: WeekRecord;
  readonly current: number;
  readonly total: number;
  readonly kind: "new" | "updated";
}

export interface SyncCounts {
  readonly new: number;
  readonly updated: number;
  readonly skipped: number;
  readonly totalWeeks: number;
}

export interface DoneEvent {
  readonly type: "done";
  readonly counts: SyncCounts;
}

export interface ErrorEvent {
  readonly type: "error";
  readonly message: string;
  readonly status?: number;
}
