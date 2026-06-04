/**
 * Timesheets feature — the read-only viewer: week + day-detail history,
 * edit-audit, and the cached profile/weeks store.
 */
export {
  WeekDetail,
  WeekSubmit,
  fullWeekDays,
  aggregateTasks,
  type TaskTotal,
} from "./components/week-detail";
export { DayDetail } from "./components/day-detail";
export { useViewerCache, useSubmitWeek, type ViewerCacheApi, type SubmitWeekApi } from "./hooks";
