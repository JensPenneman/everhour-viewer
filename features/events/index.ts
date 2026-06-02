/**
 * Events feature — day-event overlays (manual + holiday/ICS providers): the
 * integrations dialog, the day chips/controls, and the events hook. Day-event
 * domain logic + providers live in `@/lib/events` / `@/lib/providers` (shared
 * kernel, also used by storage); this module is the feature UI + hook.
 */
export { IntegrationsDialog, type IntegrationsDialogProps } from "./components/integrations";
export {
  EventChip,
  type EventChipProps,
  AddEventControl,
  type AddEventControlProps,
} from "./components/day-event";
export { useDayEvents, type DayEventsApi } from "./hooks";
