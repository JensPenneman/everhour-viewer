"use client";

import type { WeekDay } from "@/lib/everhour";
import { capitalize, fmtDateShort, fmtHours, nlWeekday, parseLocalDate } from "@/lib/format";

export interface DailyChartProps {
  readonly days: ReadonlyArray<WeekDay>;
}

/**
 * Seven-column bar chart of hours per day, normalised against the busiest
 * day in the week. Empty days render a faint placeholder so the layout
 * stays balanced.
 */
export function DailyChart({ days }: DailyChartProps) {
  const maxDay = Math.max(1, ...days.map((d) => d.totalSeconds));

  return (
    <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl px-5 py-4 grid grid-cols-7 gap-3 mb-7">
      {days.map((d) => {
        const isEmpty = d.totalSeconds === 0;
        const pct = (d.totalSeconds / maxDay) * 100;
        const label = capitalize(nlWeekday(parseLocalDate(d.date))).slice(0, 3);
        return (
          <div key={d.date} className="flex flex-col items-center gap-1.5">
            <div
              className={`text-[12px] tabular-nums font-medium min-h-[18px] ${
                isEmpty ? "text-[var(--muted-soft)]" : ""
              }`}
            >
              {isEmpty ? "—" : `${fmtHours(d.totalSeconds)}u`}
            </div>
            <div className="w-full h-[88px] flex items-end">
              <div
                className={`w-full rounded-t min-h-[2px] ${
                  isEmpty ? "bg-[var(--border)]" : "bg-[var(--accent)]"
                }`}
                style={{ height: `${pct.toFixed(2)}%` }}
              />
            </div>
            <div className="text-[11px] text-[var(--muted)]">{label}</div>
            <div className="text-[10px] text-[var(--muted-soft)] tabular-nums">
              {fmtDateShort(d.date)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
