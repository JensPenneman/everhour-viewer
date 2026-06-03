import { STORAGE_KEYS } from "./keys";

/**
 * The single pending *scheduled timer transition* — the backbone shared by the
 * "Pauze" (break) and "Gespaarde minuten" (apply) features.
 *
 * Both features reduce to the same primitive: at `fireAt`, flip the single
 * Everhour timer in one direction. A break stops the timer now and schedules a
 * `start` (resume the same task after the break). An apply starts a timer now
 * and schedules a `stop` (so exactly the banked minutes get logged via the only
 * permitted write path — start/stop — since this key cannot edit time directly).
 *
 * Everhour allows only one active timer per user, so there is at most one
 * pending transition. It is persisted (versioned blob, mirroring
 * {@link readManualEvents}) so a reload mid-break/apply doesn't lose it — the
 * engine catches up on load/focus.
 */

export type TransitionKind = "start" | "stop";
export type TransitionReason = "break" | "apply";

/** Enough of a task to re-start a timer on it and render it without a re-fetch. */
export interface TaskMeta {
  readonly id: string;
  readonly name: string;
  readonly linearKey: string | null;
  readonly url: string | null;
}

export interface ScheduledTransition {
  readonly kind: TransitionKind;
  readonly reason: TransitionReason;
  /** The task to resume (`break`) or that the apply timer runs on (`apply`). */
  readonly task: TaskMeta;
  /** epoch ms when this should fire. */
  readonly fireAt: number;
  /** epoch ms the schedule was created — used for "X late" and elapsed math. */
  readonly createdAt: number;
}

interface ScheduleFile {
  readonly schemaVersion: 1;
  readonly transition: ScheduledTransition | null;
}

/* ── Cached snapshot ───────────────────────────────────────────────────────
 * `useSyncExternalStore` requires a referentially-stable snapshot between
 * renders. We cache by the raw string last seen, so an unchanged key always
 * returns the same object reference (no render loop). */
let lastRaw: string | null | undefined;
let snapshot: ScheduledTransition | null = null;

/**
 * Same-tab subscribers. We notify these directly rather than dispatching a
 * synthetic `StorageEvent`: other "storage" listeners (e.g. React Query
 * Devtools) read a synthetic event's null `newValue` as a deletion and remove
 * the very key we just wrote. The native event is still used, but only for
 * genuine cross-tab changes (which carry a correct `newValue`).
 */
const listeners = new Set<() => void>();

function parse(raw: string | null): ScheduledTransition | null {
  if (!raw) return null;
  try {
    const file = JSON.parse(raw) as Partial<ScheduleFile>;
    const t = file.transition;
    return isTransition(t) ? t : null;
  } catch {
    return null;
  }
}

/** Read the pending transition (SSR-safe; stable reference while unchanged). */
export function readSchedule(): ScheduledTransition | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEYS.timerSchedule);
  if (raw === lastRaw) return snapshot;
  lastRaw = raw;
  snapshot = parse(raw);
  return snapshot;
}

/** Persist (or clear, with `null`) the pending transition. */
export function writeSchedule(transition: ScheduledTransition | null): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (transition === null) {
      window.localStorage.removeItem(STORAGE_KEYS.timerSchedule);
    } else {
      const payload: ScheduleFile = { schemaVersion: 1, transition };
      window.localStorage.setItem(STORAGE_KEYS.timerSchedule, JSON.stringify(payload));
    }
  } catch {
    return false;
  }
  // Notify same-tab subscribers directly (see `listeners` above).
  for (const l of listeners) l();
  return true;
}

/** Subscribe a `useSyncExternalStore` to schedule changes (same-tab + cross-tab). */
export function subscribeSchedule(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  listeners.add(onChange);
  const handler = (e: StorageEvent) => {
    if (e.key === null || e.key === STORAGE_KEYS.timerSchedule) onChange();
  };
  window.addEventListener("storage", handler);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", handler);
  };
}

function isTransition(t: unknown): t is ScheduledTransition {
  if (!t || typeof t !== "object") return false;
  const x = t as Record<string, unknown>;
  return (
    (x["kind"] === "start" || x["kind"] === "stop") &&
    (x["reason"] === "break" || x["reason"] === "apply") &&
    typeof x["fireAt"] === "number" &&
    typeof x["createdAt"] === "number" &&
    !!x["task"] &&
    typeof (x["task"] as Record<string, unknown>)["id"] === "string"
  );
}
