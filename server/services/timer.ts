import "server-only";

import type { Timer } from "@/lib/everhour/types";
import { getCurrentTimer, startTimer, stopTimer } from "@/server/everhour";

/**
 * Timer service (business layer).
 *
 * Thin today — the data layer already confirms start/stop by re-reading — but
 * it is the seam where timer policy would live, and keeps the route handlers
 * free of any knowledge of the Everhour client.
 */
export function getTimer(key: string, signal?: AbortSignal): Promise<Timer> {
  return getCurrentTimer(key, signal);
}

export function startTimerForTask(
  key: string,
  taskId: string,
  signal?: AbortSignal,
): Promise<Timer> {
  return startTimer(key, taskId, signal);
}

export function stopRunningTimer(key: string, signal?: AbortSignal): Promise<Timer> {
  return stopTimer(key, signal);
}
