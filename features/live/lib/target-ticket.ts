import type { LiveEntry, TaskHit, WeekTaskRef } from "@/lib/everhour";
import type { TaskMeta } from "@/lib/storage";

/**
 * Pick the ticket the saved-minutes net is applied to ("the last ticket of the
 * day"). `LiveEntry` carries no per-entry timestamp (only date + seconds), so
 * "last today" is best-effort: the last entry the time range returned. The user
 * can always override via {@link candidateTargets}.
 */

export function toMeta(t: TaskHit | WeekTaskRef): TaskMeta {
  return { id: t.id, name: t.name, linearKey: t.linearKey, url: t.url };
}

const hasId = (t: { id: string }): boolean => t.id.trim().length > 0;

export interface TargetInputs {
  readonly todayEntries: ReadonlyArray<LiveEntry>;
  readonly runningTask: TaskHit | null;
  readonly recent: ReadonlyArray<WeekTaskRef>;
}

/** Default apply target: last today entry → running task → most recent → none. */
export function pickApplyTarget({
  todayEntries,
  runningTask,
  recent,
}: TargetInputs): TaskMeta | null {
  for (let i = todayEntries.length - 1; i >= 0; i--) {
    const task = todayEntries[i]?.task;
    if (task && hasId(task)) return toMeta(task);
  }
  if (runningTask && hasId(runningTask)) return toMeta(runningTask);
  const first = recent.find(hasId);
  return first ? toMeta(first) : null;
}

/** De-duplicated list of plausible apply targets for the override picker. */
export function candidateTargets(
  { todayEntries, runningTask, recent }: TargetInputs,
  limit = 10,
): ReadonlyArray<TaskMeta> {
  const out: TaskMeta[] = [];
  const seen = new Set<string>();
  const push = (t: TaskHit | WeekTaskRef | null) => {
    if (!t || !hasId(t) || seen.has(t.id)) return;
    seen.add(t.id);
    out.push(toMeta(t));
  };
  for (let i = todayEntries.length - 1; i >= 0; i--) push(todayEntries[i]?.task ?? null);
  push(runningTask);
  for (const t of recent) push(t);
  return out.slice(0, limit);
}
