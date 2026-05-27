import type { DayEventKind } from "./types";

export interface DayEventKindMeta {
  readonly kind: DayEventKind;
  readonly label: string;
  readonly emoji: string;
  /** CSS color tokens for the chip; mirrors the StatusPill variable names. */
  readonly bgVar: string;
  readonly fgVar: string;
}

/**
 * Display metadata per event kind. Order matters: this is what the
 * "Markeer als …" dropdown shows.
 */
export const DAY_EVENT_KINDS: ReadonlyArray<DayEventKindMeta> = [
  { kind: "holiday", label: "Feestdag", emoji: "🎉", bgVar: "--open-bg", fgVar: "--open" },
  { kind: "leave", label: "Verlof", emoji: "🏖️", bgVar: "--accent-bg", fgVar: "--accent" },
  { kind: "sick", label: "Ziek", emoji: "🤒", bgVar: "--warn-bg", fgVar: "--warn" },
  {
    kind: "office_closed",
    label: "Kantoor gesloten",
    emoji: "🏢",
    bgVar: "--hover",
    fgVar: "--muted",
  },
  { kind: "other", label: "Anders", emoji: "📌", bgVar: "--hover", fgVar: "--muted" },
];

export function dayEventKindMeta(kind: DayEventKind): DayEventKindMeta {
  return DAY_EVENT_KINDS.find((m) => m.kind === kind) ?? DAY_EVENT_KINDS[4]!;
}
