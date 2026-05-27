import type { DayEventKind } from "./types";

export interface DayEventKindMeta {
  readonly kind: DayEventKind;
  readonly label: string;
  readonly emoji: string;
  /** Tailwind background class for the chip (e.g. `bg-open-bg`). */
  readonly bgClass: string;
  /** Tailwind text/foreground class for the chip (e.g. `text-open`). */
  readonly fgClass: string;
  /**
   * Tailwind background class used for the chart dot indicator;
   * defaults to the same as the chip foreground.
   */
  readonly dotClass: string;
}

/**
 * Display metadata per event kind. Order matters: this is what the
 * "Markeer als …" dropdown shows.
 *
 * The chip / dot colors mirror the StatusPill palette so the visual
 * vocabulary stays consistent across status badges and day-event chips.
 */
export const DAY_EVENT_KINDS: ReadonlyArray<DayEventKindMeta> = [
  {
    kind: "holiday",
    label: "Feestdag",
    emoji: "🎉",
    bgClass: "bg-open-bg",
    fgClass: "text-open",
    dotClass: "bg-open",
  },
  {
    kind: "leave",
    label: "Verlof",
    emoji: "🏖️",
    bgClass: "bg-accent-bg",
    fgClass: "text-accent",
    dotClass: "bg-accent",
  },
  {
    kind: "sick",
    label: "Ziek",
    emoji: "🤒",
    bgClass: "bg-warn-bg",
    fgClass: "text-warn",
    dotClass: "bg-warn",
  },
  {
    kind: "office_closed",
    label: "Kantoor gesloten",
    emoji: "🏢",
    bgClass: "bg-hover",
    fgClass: "text-muted",
    dotClass: "bg-muted-soft",
  },
  {
    kind: "other",
    label: "Anders",
    emoji: "📌",
    bgClass: "bg-hover",
    fgClass: "text-muted",
    dotClass: "bg-muted-soft",
  },
];

const OTHER_META = DAY_EVENT_KINDS[DAY_EVENT_KINDS.length - 1]!;

/**
 * Look up the display metadata for a day-event kind.
 *
 * Falls back to the `other` row for any unrecognised input so callers
 * can render *something* rather than crashing on data drift.
 */
export function dayEventKindMeta(kind: DayEventKind): DayEventKindMeta {
  return DAY_EVENT_KINDS.find((m) => m.kind === kind) ?? OTHER_META;
}
