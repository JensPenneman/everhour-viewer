"use client";

import type { DayEvent, DayEventKind } from "@/lib/events";
import type { WeekDay } from "@/lib/everhour";
import { capitalize, fmtDateFull, fmtHours, nlWeekday, parseLocalDate } from "@/lib/format";
import { AddEventControl, EventChip } from "../day-event";

export interface DayBreakdownProps {
  readonly days: ReadonlyArray<WeekDay>;
  readonly eventsForDate?: (isoDate: string) => ReadonlyArray<DayEvent>;
  readonly onAddEvent?: (date: string, kind: DayEventKind) => void;
  readonly onRemoveEvent?: (id: string) => void;
}

export function DayBreakdown({
  days,
  eventsForDate,
  onAddEvent,
  onRemoveEvent,
}: DayBreakdownProps) {
  return (
    <div className="flex flex-col gap-1.5 mb-4">
      {days.map((d) => (
        <DayRow
          key={d.date}
          day={d}
          events={eventsForDate?.(d.date) ?? []}
          onAddEvent={onAddEvent}
          onRemoveEvent={onRemoveEvent}
        />
      ))}
    </div>
  );
}

interface DayRowProps {
  readonly day: WeekDay;
  readonly events: ReadonlyArray<DayEvent>;
  readonly onAddEvent?: (date: string, kind: DayEventKind) => void;
  readonly onRemoveEvent?: (id: string) => void;
}

function DayRow({ day, events, onAddEvent, onRemoveEvent }: DayRowProps) {
  const clock = day.clockIn ? `${day.clockIn} – ${day.clockOut || "(open)"}` : "";

  return (
    <details className="bg-[var(--panel)] border border-[var(--border)] rounded-xl px-4 py-2.5 group">
      <summary className="cursor-pointer flex items-center gap-3 list-none">
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          className="text-[var(--muted-soft)] transition-transform group-open:rotate-90 flex-shrink-0"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M3 1l4 4-4 4z" />
        </svg>
        <span className="font-semibold min-w-[100px] text-[13.5px]">
          {capitalize(nlWeekday(parseLocalDate(day.date)))}
        </span>
        <span className="text-[var(--muted)] min-w-[110px] tabular-nums text-[12.5px]">
          {fmtDateFull(day.date)}
        </span>
        {events.length > 0 ? (
          <span className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
            {events.map((ev) => (
              <EventChip key={ev.id} event={ev} compact />
            ))}
          </span>
        ) : (
          <span className="text-[var(--muted)] flex-1 text-[12px] tabular-nums">{clock}</span>
        )}
        <span className="tabular-nums font-medium text-[13px]">{fmtHours(day.totalSeconds)}u</span>
      </summary>
      <div className="mt-2.5 pl-6 border-t border-[var(--border)] pt-2.5">
        {events.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5 mb-3">
            {events.map((ev) => (
              <EventChip
                key={`expanded-${ev.id}`}
                event={ev}
                onRemove={
                  ev.source === "manual" && onRemoveEvent ? () => onRemoveEvent(ev.id) : undefined
                }
              />
            ))}
          </div>
        ) : null}

        {day.entries.length === 0 ? (
          <div className="text-[var(--muted-soft)] italic text-[13px] py-1">
            Geen tijdregistraties
          </div>
        ) : (
          day.entries.map((entry, idx) => (
            <div key={idx} className="flex gap-3 py-1 text-[13px] items-baseline">
              <span className="text-[var(--muted)] w-20 flex-shrink-0 tabular-nums font-medium">
                {entry.task.url ? (
                  <a
                    href={entry.task.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--accent)] hover:underline"
                  >
                    {entry.task.linearKey || ""}
                  </a>
                ) : (
                  entry.task.linearKey || ""
                )}
              </span>
              <span className="flex-1">{entry.task.name}</span>
              <span className="w-16 text-right tabular-nums text-[var(--muted)]">
                {fmtHours(entry.seconds)}u
              </span>
            </div>
          ))
        )}

        {onAddEvent ? (
          <div className="mt-3 pt-2 border-t border-[var(--border)]">
            <AddEventControl onPick={(kind) => onAddEvent(day.date, kind)} />
          </div>
        ) : null}
      </div>
    </details>
  );
}
