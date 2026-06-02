import "server-only";

import type { TaskHit } from "@/lib/everhour/types";
import { searchTasks } from "@/server/everhour";

/** Minimum query length before we hit the upstream search. */
const MIN_QUERY = 2;

/**
 * Task-search service (business layer). Owns the "don't search on 1 char"
 * policy that used to live inline in the route, so the route just validates
 * shape and delegates.
 */
export function searchTasksService(
  key: string,
  query: string | undefined,
  signal?: AbortSignal,
): Promise<ReadonlyArray<TaskHit>> {
  const q = query?.trim() ?? "";
  if (q.length < MIN_QUERY) return Promise.resolve([]);
  return searchTasks(key, q, signal);
}
