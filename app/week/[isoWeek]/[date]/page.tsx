"use client";

import { useParams } from "next/navigation";
import { DayDetail, fullWeekDays } from "@/features/timesheets";
import { weekHref } from "@/lib/routing";
import { useViewer } from "@/shared/components";

/** `/week/[isoWeek]/[date]` — the day-detail (entries, edit audit, breaks). */
export default function DayPage() {
  const { isoWeek, date } = useParams<{ isoWeek: string; date: string }>();
  const { cache, eventsForDate, navigate } = useViewer();

  const week = cache.sortedWeeks.find((w) => w.week.isoWeek === isoWeek);
  const day = week ? fullWeekDays(week).find((d) => d.date === date) : undefined;
  if (!week || !day) {
    return <div className="text-muted">Dag niet gevonden — synchroniseer of kies een week.</div>;
  }

  return (
    <DayDetail
      week={week}
      day={day}
      events={eventsForDate(date)}
      tzOffsetHours={cache.profile?.timezone ?? null}
      onBack={() => navigate(weekHref(isoWeek))}
    />
  );
}
