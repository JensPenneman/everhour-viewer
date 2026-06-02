/**
 * The Everhour **data layer** (server-only): the raw HTTP client and the
 * domain operations layered on top of it. Importing from here is what marks
 * code as server-side — these modules carry `server-only`, so a Client
 * Component that reaches for them fails at build time rather than leaking the
 * API key. The isomorphic pieces (types, errors, iso-week, transforms) live in
 * `@/lib/everhour`.
 */
export { everhourFetch, type FetchOptions, type HttpMethod } from "./client";
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
  type FetchTimesheetListOptions,
  type FetchWeekEntriesOptions,
} from "./api";
