"use client";

import { useEffect, useState } from "react";
import type { TaskHit } from "@/lib/everhour";

export interface TaskSearchApi {
  readonly query: string;
  readonly setQuery: (q: string) => void;
  readonly results: ReadonlyArray<TaskHit>;
  readonly searching: boolean;
  readonly error: string | null;
}

const DEBOUNCE_MS = 250;
const MIN_QUERY = 2;

/** Debounced task search against `/api/tasks`, for the timer task picker. */
export function useTaskSearch(apiKey: string | null): TaskSearchApi {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ReadonlyArray<TaskHit>>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    // Synchronous resets/loading flags are the intended debounced-fetch
    // pattern; the result setState lives in the async callback below.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (q.length < MIN_QUERY) {
      setResults([]);
      setSearching(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    setSearching(true);
    setError(null);
    /* eslint-enable react-hooks/set-state-in-effect */

    const timer = setTimeout(async () => {
      try {
        const resp = await fetch(`/api/tasks?q=${encodeURIComponent(q)}`, {
          headers: apiKey ? { "x-everhour-key": apiKey } : {},
          signal: controller.signal,
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        setResults((await resp.json()) as TaskHit[]);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError("Zoeken mislukt");
      } finally {
        setSearching(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, apiKey]);

  return { query, setQuery, results, searching, error };
}
