"use client";

import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { TaskHit } from "@/lib/everhour";
import { liveFetch, liveKeys } from "@/lib/query";

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
 * Debounced task search against `/api/tasks`, for the timer task picker.
 *
 * The raw input is debounced into the query key; the previous results stay
 * visible while the next query loads (`keepPreviousData`) so the list doesn't
 * flicker between keystrokes.
 */
export function useTaskSearch(apiKey: string | null): TaskSearchApi {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  const enabled = debounced.length >= MIN_QUERY;
  const search = useQuery({
    queryKey: liveKeys.tasks(debounced),
    queryFn: ({ signal }) =>
      liveFetch<TaskHit[]>(`/api/tasks?q=${encodeURIComponent(debounced)}`, apiKey, { signal }),
    enabled,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });

  return {
    query,
    setQuery,
    results: enabled ? (search.data ?? []) : [],
    searching: enabled && search.isFetching,
    error: search.isError ? "Zoeken mislukt" : null,
  };
}
