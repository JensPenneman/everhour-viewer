/**
 * Live "Vandaag" feature — active timer tracking, clock, day/week targets.
 * Public surface: the composed view. Hooks/lib are internal.
 */
export { TodayView, type TodayViewProps } from "./components";
export {
  LiveSessionProvider,
  type LiveSessionProviderProps,
  ShellTimer,
  type ShellTimerProps,
  useLiveSession,
  type LiveSessionApi,
} from "./components";
