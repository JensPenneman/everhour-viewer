"use client";

import { Button } from "@/components/ui";
import type { ClockStatus } from "@/lib/everhour";

export interface ClockCardProps {
  readonly clock: ClockStatus | null;
  readonly busy: boolean;
  readonly unavailable: boolean;
  readonly onClockIn: () => void;
  readonly onClockOut: () => void;
}

/**
 * Attendance clock status + manual controls. Clock-in already fires
 * automatically when a timer starts, so this is mostly informational; if the
 * manual endpoint isn't available the buttons disable with a note.
 */
export function ClockCard({ clock, busy, unavailable, onClockIn, onClockOut }: ClockCardProps) {
  const clockedIn = clock?.clockedIn ?? false;

  const status = clockedIn
    ? `Ingeklokt sinds ${clock?.clockIn}`
    : clock?.clockOut
      ? `Uitgeklokt om ${clock.clockOut}`
      : "Niet ingeklokt";

  return (
    <div className="bg-panel border border-border rounded-xl px-4 py-3.5 mb-5 flex items-center gap-3">
      <span
        className={`inline-block h-2.5 w-2.5 rounded-full shrink-0 ${clockedIn ? "bg-good" : "bg-muted-soft"}`}
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] font-medium">{status}</div>
        <div className="text-[12px] text-muted-soft mt-0.5">
          {unavailable
            ? "Handmatig klokken niet beschikbaar — gebeurt automatisch met de timer."
            : "Klok loopt automatisch mee met je timer."}
        </div>
      </div>
      {!unavailable ? (
        clockedIn ? (
          <Button
            variant="default"
            size="sm"
            disabled={busy}
            onClick={onClockOut}
            className="shrink-0"
          >
            {busy ? "…" : "Uitklokken"}
          </Button>
        ) : (
          <Button
            variant="default"
            size="sm"
            disabled={busy}
            onClick={onClockIn}
            className="shrink-0"
          >
            {busy ? "…" : "Inklokken"}
          </Button>
        )
      ) : null}
    </div>
  );
}
