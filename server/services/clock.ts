import "server-only";

import type { ClockStatus } from "@/lib/everhour/types";
import { clockInOut, getClockToday } from "@/server/everhour";

/** Clock service (business layer): today's attendance status + manual control. */
export function getClock(
  key: string,
  userId: number,
  today: string,
  signal?: AbortSignal,
): Promise<ClockStatus> {
  return getClockToday(key, userId, today, signal);
}

export function clock(key: string, action: "in" | "out", signal?: AbortSignal): Promise<void> {
  return clockInOut(key, action, signal);
}
