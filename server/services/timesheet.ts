import "server-only";

import { submitWeekForApproval, type SubmittedApproval } from "@/server/everhour";

/**
 * Timesheet service (business layer): committing a week for approval.
 *
 * Thin — the data layer already sanitises the approval response — but it's the
 * seam where submission policy would live, and keeps the tRPC router free of
 * any knowledge of the Everhour client.
 */
export function submitWeek(
  key: string,
  userId: number,
  weekId: number,
  signal?: AbortSignal,
): Promise<SubmittedApproval> {
  return submitWeekForApproval({ key, userId, weekId, signal });
}
