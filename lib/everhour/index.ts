/**
 * Public surface of the everhour library.
 *
 * Imports from this barrel are stable; the underlying file layout may
 * change. `server-only` boundaries are enforced by `lib/everhour/api.ts`
 * itself — re-exporting through this barrel is fine because the
 * `server-only` import surfaces at the leaf module.
 */

export { EverhourError } from "./errors";
export { isoWeekLabel } from "./iso-week";
export { sanitizeProfile, buildWeek } from "./transforms";
export {
  fetchProfile,
  fetchTeamMembers,
  fetchTimesheetList,
  fetchWeekEntries,
  getCurrentTimer,
  startTimer,
  stopTimer,
  searchTasks,
  getClockToday,
  clockInOut,
  fetchTimeRange,
} from "./api";
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
