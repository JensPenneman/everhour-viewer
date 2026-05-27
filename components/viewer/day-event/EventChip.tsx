"use client";

import { dayEventKindMeta, type DayEvent } from "@/lib/events";

export interface EventChipProps {
  readonly event: DayEvent;
  readonly onRemove?: () => void;
  readonly compact?: boolean;
  readonly title?: string;
}

/**
 * Pill rendering a single {@link DayEvent}.
 *
 * Manual events get a `×` remove handle. Static-source events (e.g.
 * holidays, ICS-imported entries) are read-only — the chip renders
 * without the handle.
 */
export function EventChip({ event, onRemove, compact, title }: EventChipProps) {
  const meta = dayEventKindMeta(event.kind);
  const sizeClass = compact ? "text-[10px] py-[1.5px]" : "text-[11px] py-[2.5px]";

  return (
    <span
      title={title ?? labelForTitle(event)}
      className={`inline-flex items-center gap-1 rounded-full font-medium whitespace-nowrap px-2 tracking-[0.2px] ${sizeClass} ${meta.bgClass} ${meta.fgClass}`}
    >
      <span aria-hidden="true">{meta.emoji}</span>
      <span>{event.label}</span>
      {onRemove ? (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 -mr-1 cursor-pointer opacity-60 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current focus-visible:ring-offset-1 rounded-full leading-none"
          aria-label={`Verwijder ${event.label}`}
        >
          ×
        </button>
      ) : null}
    </span>
  );
}

function labelForTitle(event: DayEvent): string {
  const meta = dayEventKindMeta(event.kind);
  const parts = [meta.label, event.label, event.description].filter(Boolean);
  return parts.join(" · ");
}
