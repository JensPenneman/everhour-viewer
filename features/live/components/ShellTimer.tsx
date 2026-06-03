"use client";

import type { ReactNode } from "react";
import { Button } from "@/shared/ui";
import type { TaskMeta } from "@/lib/storage";
import { fmtCountdown } from "./BreakCountdown";
import { useLiveSession } from "./live-session-context";
import { fmtClock } from "./RunningTimer";

type Tone = "accent" | "warn";

export interface ShellTimerProps {
  /** Hidden on Vandaag, where the full hero already shows the timer. */
  readonly hidden?: boolean;
}

/**
 * A slim strip in the shell chrome that surfaces the running timer — and the
 * break / apply countdowns — on every route except Vandaag, with the same
 * controls. Reads the shared {@link useLiveSession}; renders nothing when idle.
 */
export function ShellTimer({ hidden }: ShellTimerProps) {
  const s = useLiveSession();
  if (hidden) return null;

  if (s.breakPending && s.schedule) {
    return (
      <Bar tone="warn">
        <Label>
          <span className="uppercase tracking-wider text-[11px] font-semibold text-warn">
            Pauze
          </span>
          <TaskName task={s.schedule.task} />
          <Remaining label="hervat over" ms={s.remainingMs} />
        </Label>
        <Button size="sm" variant="primary" onClick={s.fireNow}>
          Hervat nu
        </Button>
        <Button size="sm" variant="ghost" onClick={s.cancel}>
          Annuleer
        </Button>
      </Bar>
    );
  }

  if (s.applyPending && s.schedule) {
    return (
      <Bar tone="accent">
        <Dot />
        <Label>
          <span className="uppercase tracking-wider text-[11px] font-semibold text-accent">
            Boeken
          </span>
          <TaskName task={s.schedule.task} />
          <Remaining label="stopt over" ms={s.remainingMs} />
        </Label>
        <Button size="sm" variant="danger" onClick={s.fireNow}>
          Stop nu
        </Button>
      </Bar>
    );
  }

  if (s.timer?.running && s.timer.task) {
    return (
      <Bar tone="accent">
        <Dot />
        <Label>
          <span className="uppercase tracking-wider text-[11px] font-semibold text-accent">
            Loopt
          </span>
          <TaskName task={s.timer.task} />
          <span className="tabular-nums font-semibold">{fmtClock(s.elapsedSec)}</span>
        </Label>
        <Button size="sm" variant="default" onClick={s.openBreak}>
          Pauze
        </Button>
        <Button size="sm" variant="danger" onClick={s.stop} disabled={s.busy === "stop"}>
          Stop
        </Button>
      </Bar>
    );
  }

  return null;
}

function Bar({ tone, children }: { tone: Tone; children: ReactNode }) {
  const bg = tone === "warn" ? "bg-warn-bg" : "bg-accent-bg";
  return (
    <div
      role="status"
      className={`${bg} border-b border-border px-5 py-1.5 flex items-center gap-3 text-[13px]`}
    >
      {children}
    </div>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <div className="flex-1 min-w-0 flex items-center gap-2.5 truncate">{children}</div>;
}

function TaskName({ task }: { task: Pick<TaskMeta, "name" | "linearKey"> }) {
  return (
    <span className="truncate">
      {task.linearKey ? (
        <span className="tabular-nums font-medium text-muted">{task.linearKey} </span>
      ) : null}
      {task.name}
    </span>
  );
}

function Remaining({ label, ms }: { label: string; ms: number }) {
  return (
    <span className="text-muted shrink-0">
      {label} <span className="tabular-nums font-semibold text-foreground">{fmtCountdown(ms)}</span>
    </span>
  );
}

function Dot() {
  return <span aria-hidden="true" className="h-2 w-2 rounded-full bg-accent animate-pulse" />;
}
