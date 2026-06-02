"use client";

import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { TaskHit } from "@/lib/everhour";
import { useTRPC } from "@/lib/trpc/client";

export interface TaskSearchApi {
  readonly query: string;
  readonly setQuery: (q: string) => void;
  readonly results: ReadonlyArray<TaskHit>;
  readonly searching: boolean;
  readonly error: string | null;
}

const DEBOUNCE_MS = 250;
const MIN_QUERY = 2;

/**
 * Debounced task search (tRPC `tasks.search`) for the timer task picker.
 *
 * The raw input is debounced into the query input/key; previous results stay
 * visible while the next query loads (`keepPreviousData`) so the list doesn't
 * flicker between keystrokes. The API key is attached by the tRPC link.
 */
export function useTaskSearch(): TaskSearchApi {
  const trpc = useTRPC();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  const enabled = debounced.length >= MIN_QUERY;
  const search = useQuery(
    trpc.tasks.search.queryOptions(
      { q: debounced },
      {
        enabled,
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        placeholderData: keepPreviousData,
      },
    ),
  );

  return {
    query,
    setQuery,
    results: enabled ? (search.data ?? []) : [],
    searching: enabled && search.isFetching,
    error: search.isError ? "Zoeken mislukt" : null,
  };
}
