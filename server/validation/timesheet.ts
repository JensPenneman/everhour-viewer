import { z } from "zod";

/**
 * Request-boundary schema for the timesheet (week-approval) tRPC procedure.
 *
 * Mirrors `validation/live.ts`: the single place where the untrusted request
 * shape is narrowed into typed values before the service layer runs. Both ids
 * are positive integers; `weekId` is Everhour's internal week id (from the
 * cached {@link WeekRecord}), not an ISO-week string.
 */
export const submitWeekSchema = z
  .object({
    userId: z.coerce.number().int().positive(),
    weekId: z.coerce.number().int().positive(),
  })
  .strict();
