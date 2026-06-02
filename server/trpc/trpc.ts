import "server-only";

import { initTRPC, TRPCError } from "@trpc/server";
import { EverhourError } from "@/lib/everhour";

/**
 * Per-request tRPC context: the resolved Everhour API key, mirroring
 * `/api/sync`'s model — the browser-supplied `x-everhour-key` header, with
 * `EVERHOUR_API_KEY` as a server-side dev fallback. Never persisted.
 */
export function createContext({ req }: { req: Request }): { key: string | null } {
  const key = req.headers.get("x-everhour-key")?.trim() || process.env.EVERHOUR_API_KEY || null;
  return { key };
}
export type TRPCContext = ReturnType<typeof createContext>;

const t = initTRPC.context<TRPCContext>().create({
  // Surface the upstream Everhour HTTP status so the client can branch on it
  // (e.g. a 4xx on clock-in/out → "manual clock control unavailable").
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        everhourStatus: error.cause instanceof EverhourError ? error.cause.status : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

/**
 * A procedure that requires a resolved API key and narrows `ctx.key` to a
 * non-null string for the resolver. Missing key → UNAUTHORIZED (the client
 * gates on `canSync`, so this is a backstop).
 */
export const keyedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.key) throw new TRPCError({ code: "UNAUTHORIZED", message: "no_api_key" });
  return next({ ctx: { key: ctx.key } });
});
