/**
 * Pure logic for submitting (committing) a week's timesheet for approval.
 *
 * Kept isomorphic (no `server-only`, no fetch) so both the client UI (gating
 * the "Week indienen" button, optimistic status update) and the unit tests can
 * use it. The actual network call lives in `@/server/everhour`.
 */

import type { ApprovalEvent, ApprovalStatus, WeekRecord } from "./types";

/**
 * Everhour's composite timesheet id: the user id and the week id concatenated
 * into a single number (e.g. user 14856 + week 2535 → `148562535`). This is
 * the `{timesheet_id}` path segment for the approval endpoints.
 */
export function timesheetId(userId: number, weekId: number): string {
  return `${userId}${weekId}`;
}

/**
 * Which approval states can still be submitted from this app.
 *
 * Only an `unsubmitted` ("open") or previously `rejected` week can be
 * (re)submitted — a `pending` week is already awaiting review and an
 * `approved` one is closed. This mirrors what Everhour's own UI allows.
 */
const SUBMITTABLE: ReadonlySet<ApprovalStatus> = new Set<ApprovalStatus>([
  "unsubmitted",
  "rejected",
]);

/**
 * Whether the "Week indienen" action should be enabled for `week`.
 *
 * A week is submittable when its current approval status is open/rejected and
 * it has at least some recorded time — submitting an empty week is never what
 * the user means and Everhour rejects it anyway.
 */
export function canSubmitWeek(week: Pick<WeekRecord, "approval" | "totals">): boolean {
  return SUBMITTABLE.has(week.approval.status) && week.totals.seconds > 0;
}

/**
 * The approval status implied by an approval `history` array (newest action
 * wins). Mirrors how {@link buildWeek} derives status from the timesheet, so
 * an optimistic update and a real re-sync converge on the same value.
 */
export function statusFromHistory(
  history: ReadonlyArray<ApprovalEvent>,
  fallback: ApprovalStatus = "unsubmitted",
): ApprovalStatus {
  const last = history.at(-1)?.action;
  switch (last) {
    case "submitted":
      return "pending";
    case "approved":
      return "approved";
    case "rejected":
      return "rejected";
    case "discarded":
      return "unsubmitted";
    default:
      return fallback;
  }
}

/**
 * Optimistically fold a successful submission into a {@link WeekRecord}: the
 * status flips to `pending`, `submittedAt` is set, and a `submitted` event is
 * appended to the history — so the UI reflects the new state without a full
 * re-sync. `submittedAt` is the raw datetime from the new history event when
 * present, falling back to `at` (an ISO-ish string the caller passes in).
 */
export function withSubmittedApproval(week: WeekRecord, at: string): WeekRecord {
  const event: ApprovalEvent = { action: "submitted", createdAt: at };
  const history = [...week.approval.history, event];
  return {
    ...week,
    approval: {
      status: "pending",
      submittedAt: at,
      history,
    },
  };
}
