import "server-only";

import {
  clock,
  getClock,
  getTimeRange,
  getTimer,
  searchTasksService,
  startTimerForTask,
  stopRunningTimer,
} from "@/server/services";
import {
  clockActionSchema,
  clockQuerySchema,
  tasksQuerySchema,
  timeQuerySchema,
  timerStartSchema,
} from "@/server/validation/live";
import { keyedProcedure, publicProcedure, router } from "./trpc";

/**
 * The app's tRPC router — the type-safe backend↔frontend surface for every
 * discrete call. Each procedure validates with the same zod schema as the
 * old REST route and delegates to the service (business) layer; `signal` is
 * threaded through for cancellation. (Streaming sync stays on the dedicated
 * NDJSON `/api/sync` route — see useStreamingSync.)
 */
export const appRouter = router({
  system: router({
    /** Whether the server has an env API key — used by the welcome/key flow. */
    capabilities: publicProcedure.query(() => ({ hasEnvKey: !!process.env.EVERHOUR_API_KEY })),
  }),

  timer: router({
    current: keyedProcedure.query(({ ctx, signal }) => getTimer(ctx.key, signal)),
    start: keyedProcedure
      .input(timerStartSchema)
      .mutation(({ ctx, input, signal }) => startTimerForTask(ctx.key, input.taskId, signal)),
    stop: keyedProcedure.mutation(({ ctx, signal }) => stopRunningTimer(ctx.key, signal)),
  }),

  tasks: router({
    search: keyedProcedure
      .input(tasksQuerySchema)
      .query(({ ctx, input, signal }) => searchTasksService(ctx.key, input.q, signal)),
  }),

  clock: router({
    today: keyedProcedure
      .input(clockQuerySchema)
      .query(({ ctx, input, signal }) =>
        getClock(
          ctx.key,
          input.userId,
          input.today ?? new Date().toISOString().slice(0, 10),
          signal,
        ),
      ),
    set: keyedProcedure.input(clockActionSchema).mutation(async ({ ctx, input, signal }) => {
      await clock(ctx.key, input.action, signal);
      return { ok: true } as const;
    }),
  }),

  time: router({
    range: keyedProcedure
      .input(timeQuerySchema)
      .query(({ ctx, input, signal }) =>
        getTimeRange(ctx.key, input.userId, input.from, input.to, signal),
      ),
  }),
});

export type AppRouter = typeof appRouter;
