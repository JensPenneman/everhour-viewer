"use client";

import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, invalidateServerQueries } from "@/lib/query";
import { useTRPC } from "@/lib/trpc/client";
import { readApiKey, writeApiKey } from "@/lib/storage";

export interface ApiKeyApi {
  /** True when a user-supplied key is set in this browser. */
  readonly hasUserKey: boolean;
  /** True when the server reports it has an `EVERHOUR_API_KEY` env fallback. */
  readonly hasEnvKey: boolean | null;
  /** True if a sync can run with the current configuration (env or user). */
  readonly canSync: boolean;
  /** Persist (or clear, if empty) the user-supplied key. */
  readonly setUserKey: (value: string) => void;
  /** Snapshot the current user-supplied key from localStorage (for sending in headers). */
  readonly readUserKey: () => string | null;
}

/**
 * The API key + capability probe, both modelled as queries.
 *
 * The user key is a localStorage-backed query (its source of truth stays its
 * own key, not the persisted blob); cross-tab + same-tab refresh is handled by
 * the storage→invalidation bridge and the write mutation's `onSuccess`. The
 * env-key capability is a short-lived server query. A key change invalidates
 * every server query, since the credential they authenticate with changed.
 */
export function useApiKey(): ApiKeyApi {
  const client = useQueryClient();
  const trpc = useTRPC();

  const { data: userKey } = useQuery({
    queryKey: authKeys.apiKey(),
    queryFn: () => readApiKey(),
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const { data: hasEnvKey = null } = useQuery(
    trpc.system.capabilities.queryOptions(undefined, {
      staleTime: 5 * 60_000,
      retry: 1,
      select: (data) => data.hasEnvKey,
    }),
  );

  const { mutate: mutateKey } = useMutation({
    mutationFn: (value: string) => {
      writeApiKey(value);
      return Promise.resolve(value);
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: authKeys.apiKey() });
      invalidateServerQueries(client);
    },
  });

  const setUserKey = useCallback((value: string) => mutateKey(value), [mutateKey]);
  const readUserKey = useCallback(() => readApiKey(), []);

  const hasUserKey = !!userKey;
  return {
    hasUserKey,
    hasEnvKey,
    canSync: hasUserKey || hasEnvKey === true,
    setUserKey,
    readUserKey,
  };
}
