"use client";

import { dayEventKindMeta, type DayEvent } from "@/lib/events";
import type { WeekDay } from "@/lib/everhour";
import { capitalize, fmtDateShort, fmtHours, nlWeekday, parseLocalDate } from "@/lib/format";

export interface DailyChartProps {
  readonly days: ReadonlyArray<WeekDay>;
  readonly eventsForDate?: (isoDate: string) => ReadonlyArray<DayEvent>;
}

/**
 * Seven-column bar chart of hours per day, normalised against the busiest
 * day in the week. Empty days render a faint placeholder so the layout
 * stays balanced.
 *
 * If the day has overlay events (holiday / leave / sick / …), a small
 * coloured dot appears above the bar so the eye notices the day even
 * when Everhour itself has nothing to show.
 */
export function DailyChart({ days, eventsForDate }: DailyChartProps) {
  const maxDay = Math.max(1, ...days.map((d) => d.totalSeconds));

  return (
    <div className="bg-panel border border-border rounded-xl px-5 py-4 grid grid-cols-7 gap-3 mb-7">
      {days.map((d) => {
        const isEmpty = d.totalSeconds === 0;
        const pct = (d.totalSeconds / maxDay) * 100;
        const label = capitalize(nlWeekday(parseLocalDate(d.date))).slice(0, 3);
        const events = eventsForDate?.(d.date) ?? [];
        const primary = events[0];
        const meta = primary ? dayEventKindMeta(primary.kind) : null;

        return (
          <div key={d.date} className="flex flex-col items-center gap-1.5">
            <div
              className={`text-[12px] tabular-nums font-medium min-h-[18px] flex items-center gap-1.5 ${
                isEmpty ? "text-muted-soft" : ""
              }`}
            >
              {meta ? (
                <span
                  className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${meta.dotClass}`}
                  title={primary ? `${meta.label}: ${primary.label}` : meta.label}
                  aria-hidden="true"
                />
              ) : null}
              {isEmpty ? "—" : `${fmtHours(d.totalSeconds)}u`}
            </div>
            <div className="w-full h-[88px] flex items-end">
              <div
                className={`w-full rounded-t min-h-[2px] ${isEmpty ? "bg-border" : "bg-accent"}`}
                style={{ height: `${pct.toFixed(2)}%` }}
              />
            </div>
            <div className="text-[11px] text-muted">{label}</div>
            <div className="text-[10px] text-muted-soft tabular-nums">{fmtDateShort(d.date)}</div>
          </div>
        );
      })}
    </div>
  );
}
