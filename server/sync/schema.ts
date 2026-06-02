import { z } from "zod";

/**
 * Request schema for `POST /api/sync`.
 *
 * Validated at the route boundary with zod so malformed or hostile bodies
 * are rejected before any Everhour API call is made.
 *
 * `weeksBack` is clamped to [1, 260]; values outside that range are caller
 * mistakes, not policy choices, so we reject rather than silently coerce.
 */
export const ApprovalStatusSchema = z.enum(["pending", "approved", "rejected", "unsubmitted"]);

export const KnownWeekSchema = z.object({
  isoWeek: z.string().regex(/^\d{4}-W\d{2}$/, "isoWeek must match YYYY-Www"),
  status: ApprovalStatusSchema,
  // The schema version the client already has cached for this week. Absent
  // for pre-v3 caches; treated as stale so audit fields backfill on sync.
  schemaVersion: z.number().int().optional(),
});

export const SyncRequestSchema = z
  .object({
    knownWeeks: z.array(KnownWeekSchema).max(1000).optional().default([]),
    weeksBack: z.number().int().min(1).max(260).optional().default(78),
    force: z.boolean().optional().default(false),
  })
  .strict();

export type SyncRequest = z.infer<typeof SyncRequestSchema>;
export type KnownWeek = z.infer<typeof KnownWeekSchema>;
