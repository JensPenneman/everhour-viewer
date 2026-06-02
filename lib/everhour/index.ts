/**
 * Public surface of the everhour library — the **isomorphic** pieces only:
 * domain types, the error class, the ISO-week helper, and the pure transforms.
 *
 * This barrel is safe to import from Client Components (it pulls in no
 * `server-only` code). The server-only data layer — `everhourFetch` and the
 * `fetch*`/timer/clock operations — lives in `@/server/everhour`.
 */

export { EverhourError } from "./errors";
export { isoWeekLabel } from "./iso-week";
export { sanitizeProfile, buildWeek } from "./transforms";
export { WEEK_SCHEMA_VERSION } from "./types";
export type {
  ApprovalStatus,
  ApprovalEvent,
  BackupFile,
  ClockEvent,
  ClockStatus,
  EverhourProfile,
  LiveEntry,
  MemberMap,
  RawEntry,
  RawTeamMember,
  RawTimecard,
  RawTimesheet,
  TaskHit,
  TimeEdit,
  TimeEditAction,
  Timer,
  WeekDay,
  WeekEntry,
  WeekRecord,
  WeekTaskRef,
} from "./types";
