"use client";

import type { WeekDay } from "@/lib/everhour";
import { capitalize, fmtDateFull, fmtHours, nlWeekday, parseLocalDate } from "@/lib/format";

export interface DayBreakdownProps {
  readonly days: ReadonlyArray<WeekDay>;
}

export function DayBreakdown({ days }: DayBreakdownProps) {
  return (
    <div className="flex flex-col gap-1.5 mb-4">
      {days.map((d) => (
        <DayRow key={d.date} day={d} />
      ))}
    </div>
  );
}

function DayRow({ day }: { day: WeekDay }) {
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
        <span className="text-[var(--muted)] flex-1 text-[12px] tabular-nums">{clock}</span>
        <span className="tabular-nums font-medium text-[13px]">{fmtHours(day.totalSeconds)}u</span>
      </summary>
      <div className="mt-2.5 pl-6 border-t border-[var(--border)] pt-2.5">
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
      </div>
    </details>
  );
}
