"use client";

import { createTRPCClient, httpBatchLink, TRPCClientError } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import { readApiKey } from "@/lib/storage";
import type { AppRouter } from "@/server/trpc/router";

/**
 * Client-side tRPC, integrated with the app's existing (persisted) TanStack
 * Query client. `AppRouter` is a **type-only** import, so the server router
 * (and its `server-only` deps) is never bundled — only its types cross over,
 * giving end-to-end inference.
 */
export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();

/**
 * The upstream Everhour HTTP status carried by a tRPC error (added by the
 * server's errorFormatter), or null. Lets the live hooks branch on it — e.g.
 * a 4xx on clock-in/out → "manual clock control unavailable".
 */
export function everhourStatusOf(error: unknown): number | null {
  if (error instanceof TRPCClientError) {
    const data = error.data as { everhourStatus?: number | null } | null | undefined;
    return typeof data?.everhourStatus === "number" ? data.everhourStatus : null;
  }
  return null;
}

/** Build the tRPC client. The API key is attached per request (never persisted). */
export function makeTRPCClient() {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: "/api/trpc",
        headers() {
          const key = readApiKey();
          return key ? { "x-everhour-key": key } : {};
        },
      }),
    ],
  });
}
