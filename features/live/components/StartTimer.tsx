"use client";

import { Button, SectionTitle } from "@/shared/ui";

/** Minimal shape a timer can be started on (both search hits and recent tasks). */
export interface StartTask {
  readonly id: string;
  readonly name: string;
  readonly linearKey: string | null;
  readonly url: string | null;
}

export interface StartTimerProps {
  readonly query: string;
  readonly onQuery: (q: string) => void;
  readonly results: ReadonlyArray<StartTask>;
  readonly searching: boolean;
  readonly recent: ReadonlyArray<StartTask>;
  readonly runningTaskId: string | null;
  readonly starting: boolean;
  readonly onStart: (taskId: string) => void;
}

/** Search any task or one-tap a recent one to start a timer. */
export function StartTimer({
  query,
  onQuery,
  results,
  searching,
  recent,
  runningTaskId,
  starting,
  onStart,
}: StartTimerProps) {
  const trimmed = query.trim();
  const showResults = trimmed.length >= 2;

  return (
    <section className="mb-5">
      <SectionTitle>Start een timer</SectionTitle>

      <input
        type="search"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder="Zoek een ticket…"
        aria-label="Zoek een ticket"
        className="w-full bg-panel border border-border rounded-xl px-3.5 py-2.5 text-[13.5px] outline-none focus:border-accent"
      />

      {showResults ? (
        <div className="mt-2 bg-panel border border-border rounded-xl overflow-hidden">
          {searching && results.length === 0 ? (
            <Row muted>Zoeken…</Row>
          ) : results.length === 0 ? (
            <Row muted>Geen tickets gevonden</Row>
          ) : (
            results.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                running={t.id === runningTaskId}
                starting={starting}
                onStart={onStart}
              />
            ))
          )}
        </div>
      ) : recent.length > 0 ? (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {recent.map((t) => (
            <button
              key={t.id}
              type="button"
              disabled={starting || t.id === runningTaskId}
              onClick={() => onStart(t.id)}
              title={t.name}
              className="inline-flex items-center gap-1.5 max-w-[260px] rounded-full border border-border bg-panel px-3 py-1.5 text-[12.5px] hover:bg-hover disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <span aria-hidden="true" className="text-accent">
                ▶
              </span>
              {t.linearKey ? (
                <span className="tabular-nums font-medium text-muted">{t.linearKey}</span>
              ) : null}
              <span className="truncate">{t.name}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-2 text-[12.5px] text-muted-soft">
          Zoek een ticket om een timer te starten.
        </div>
      )}
    </section>
  );
}

function TaskRow({
  task,
  running,
  starting,
  onStart,
}: {
  task: StartTask;
  running: boolean;
  starting: boolean;
  onStart: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-b-0">
      <span className="w-[72px] shrink-0 tabular-nums text-[12px] font-medium text-muted">
        {task.linearKey || ""}
      </span>
      <span className="flex-1 min-w-0 truncate text-[13.5px]">{task.name}</span>
      <Button
        variant="primary"
        size="sm"
        disabled={starting || running}
        onClick={() => onStart(task.id)}
        className="shrink-0"
      >
        {running ? "Loopt" : "Start"}
      </Button>
    </div>
  );
}

function Row({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <div className={`px-4 py-3 text-[13px] ${muted ? "text-muted-soft italic" : ""}`}>
      {children}
    </div>
  );
}
