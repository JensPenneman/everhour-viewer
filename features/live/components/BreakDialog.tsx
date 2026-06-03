"use client";

import { useState } from "react";
import { Button, Dialog, SectionTitle } from "@/shared/ui";
import { BREAK_PRESETS_MIN, DEFAULT_BREAK_MIN } from "../lib/break-presets";

export interface BreakDialogProps {
  readonly open: boolean;
  readonly taskName: string;
  readonly onClose: () => void;
  readonly onConfirm: (minutes: number) => void;
}

const MAX_BREAK_MIN = 480;

/** Pick a break length; on confirm the timer stops now and auto-resumes later. */
export function BreakDialog({ open, taskName, onClose, onConfirm }: BreakDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} ariaLabel="Pauze instellen">
      {/* Mounts only while open (Dialog renders no children when closed), so the
          chosen duration resets to the default each time the dialog is opened. */}
      <BreakForm taskName={taskName} onClose={onClose} onConfirm={onConfirm} />
    </Dialog>
  );
}

function BreakForm({ taskName, onClose, onConfirm }: Omit<BreakDialogProps, "open">) {
  const [minutes, setMinutes] = useState<number>(DEFAULT_BREAK_MIN);

  return (
    <>
      <SectionTitle>Pauze nemen</SectionTitle>
      <p className="text-[13px] text-muted mt-1.5">
        De timer op <span className="font-medium">{taskName}</span> stopt nu en start automatisch
        opnieuw na de pauze.
      </p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {BREAK_PRESETS_MIN.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMinutes(m)}
            className={`rounded-full border px-3 py-1.5 text-[12.5px] cursor-pointer transition-colors ${
              minutes === m
                ? "border-accent bg-accent text-white"
                : "border-border bg-panel hover:bg-hover"
            }`}
          >
            {m} min
          </button>
        ))}
      </div>

      <label className="mt-4 flex items-center gap-2 text-[13px] text-muted">
        Anders:
        <input
          type="number"
          min={1}
          max={MAX_BREAK_MIN}
          value={minutes}
          onChange={(e) =>
            setMinutes(
              Math.max(1, Math.min(MAX_BREAK_MIN, Math.floor(Number(e.target.value) || 0))),
            )
          }
          aria-label="Pauzeduur in minuten"
          className="w-20 bg-panel border border-border rounded-md px-2 py-1 text-[13px] tabular-nums outline-none focus:border-accent"
        />
        min
      </label>

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Annuleer
        </Button>
        <Button variant="primary" disabled={minutes < 1} onClick={() => onConfirm(minutes)}>
          Start pauze ({minutes} min)
        </Button>
      </div>
    </>
  );
}
