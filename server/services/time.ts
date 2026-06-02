import "server-only";

import type { LiveEntry } from "@/lib/everhour/types";
import { fetchTimeRange } from "@/server/everhour";

/** Time service (business layer): committed entries for the live day/week totals. */
export function getTimeRange(
  key: string,
  userId: number,
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<ReadonlyArray<LiveEntry>> {
  return fetchTimeRange(key, userId, from, to, signal);
}
