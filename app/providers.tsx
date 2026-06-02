"use client";

import { useState } from "react";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import {
  createPersister,
  makeQueryClient,
  migrateLegacyCache,
  PERSIST_BUSTER,
  PERSIST_MAX_AGE,
  shouldDehydrateQuery,
  useStorageSync,
} from "@/lib/query";
import { makeTRPCClient, TRPCProvider } from "@/lib/trpc/client";

/**
 * Mounts the TanStack Query client + localStorage persistence for the whole
 * app. Lives in the root layout so the client survives client-side
 * navigation (no remount, no refetch). The client/persister are created once
 * per browser session via `useState` initializers — never at module scope,
 * which would share state across requests during SSR.
 *
 * Restore is async and applied after mount, so the server-rendered (empty)
 * HTML matches the first client render — no hydration mismatch. Consumers
 * read `useIsRestoring()` to defer the welcome-vs-data decision until the
 * cache is known.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  const [client] = useState(makeQueryClient);
  const [persister] = useState(createPersister);
  const [trpcClient] = useState(makeTRPCClient);

  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={{
        persister,
        maxAge: PERSIST_MAX_AGE,
        buster: PERSIST_BUSTER,
        dehydrateOptions: { shouldDehydrateQuery },
      }}
      onSuccess={() => migrateLegacyCache(client)}
    >
      <TRPCProvider trpcClient={trpcClient} queryClient={client}>
        <StorageSync />
        {children}
        {process.env.NODE_ENV === "development" ? (
          <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
        ) : null}
      </TRPCProvider>
    </PersistQueryClientProvider>
  );
}

/** Mounts the cross-tab storage→invalidation bridge once, under the provider. */
function StorageSync() {
  useStorageSync();
  return null;
}
