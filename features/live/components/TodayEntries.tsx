import { SectionTitle } from "@/shared/ui";
import type { LiveEntry } from "@/lib/everhour";
import { fmtDuration } from "@/lib/format";

export interface TodayEntriesProps {
  readonly entries: ReadonlyArray<LiveEntry>;
}

/** Compact list of today's committed time (the running session shows above). */
export function TodayEntries({ entries }: TodayEntriesProps) {
  return (
    <section>
      <SectionTitle>Vandaag geregistreerd</SectionTitle>
      {entries.length === 0 ? (
        <div className="bg-panel border border-border rounded-xl px-4 py-3 text-[13px] italic text-muted-soft">
          Nog niets geregistreerd vandaag.
        </div>
      ) : (
        <div className="bg-panel border border-border rounded-xl overflow-hidden">
          {entries.map((e, i) => (
            <div
              key={`${e.task.id}-${i}`}
              className="flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-b-0"
            >
              <span className="w-[72px] shrink-0 tabular-nums text-[12px] font-medium text-muted">
                {e.task.url ? (
                  <a
                    href={e.task.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline"
                  >
                    {e.task.linearKey || ""}
                  </a>
                ) : (
                  e.task.linearKey || ""
                )}
              </span>
              <span className="flex-1 min-w-0 truncate text-[13.5px]">{e.task.name}</span>
              <span className="shrink-0 tabular-nums text-[13px] text-muted">
                {fmtDuration(e.seconds)}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
