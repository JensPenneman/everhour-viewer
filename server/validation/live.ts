import { z } from "zod";

/**
 * Request-boundary schemas for the live API routes.
 *
 * Every `/api/{timer,tasks,clock,time}` handler validates its input through
 * one of these before touching the data layer — the single place where an
 * untrusted request shape is narrowed into typed values. Query params arrive
 * as strings, so numeric fields use `z.coerce.number`.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** POST /api/timer body. */
export const timerStartSchema = z.object({ taskId: z.string().min(1) }).strict();

/** GET /api/clock query. */
export const clockQuerySchema = z.object({
  userId: z.coerce.number().int().positive(),
  today: z.string().regex(ISO_DATE).optional(),
});

/** POST /api/clock body. */
export const clockActionSchema = z.object({ action: z.enum(["in", "out"]) }).strict();

/** GET /api/time query. */
export const timeQuerySchema = z.object({
  userId: z.coerce.number().int().positive(),
  from: z.string().regex(ISO_DATE),
  to: z.string().regex(ISO_DATE),
});

/** GET /api/tasks query. The min-length policy lives in the tasks service. */
export const tasksQuerySchema = z.object({ q: z.string().optional() });
