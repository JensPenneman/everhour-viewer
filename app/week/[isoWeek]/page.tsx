"use client";

import { useParams } from "next/navigation";
import { WeekDetail } from "@/features/timesheets";
import { dayHref } from "@/lib/routing";
import { useViewer } from "@/shared/components";

/** `/week/[isoWeek]` — the week breakdown for the ISO week in the URL. */
export default function WeekPage() {
  const { isoWeek } = useParams<{ isoWeek: string }>();
  const { cache, eventsForDate, navigate, onAddEvent, onRemoveEvent } = useViewer();

  const week = cache.sortedWeeks.find((w) => w.week.isoWeek === isoWeek);
  if (!week) {
    return <div className="text-muted">Week niet gevonden — synchroniseer of kies een week.</div>;
  }

  return (
    <WeekDetail
      week={week}
      eventsForDate={eventsForDate}
      onAddEvent={onAddEvent}
      onRemoveEvent={onRemoveEvent}
      onOpenDay={(date) => navigate(dayHref(isoWeek, date))}
    />
  );
}
