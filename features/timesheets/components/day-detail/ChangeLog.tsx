import { SectionTitle } from "@/shared/ui";
import type { ChangeRow as ChangeRowData } from "./day-audit";
import { ChangeRow } from "./ChangeRow";

export interface ChangeLogProps {
  readonly rows: ReadonlyArray<ChangeRowData>;
  readonly foreignCount: number;
  readonly dayDate: string;
  readonly tzOffsetHours: number | null;
}

/**
 * The "Wat is gewijzigd" feed. Always rendered — an explicit empty state is
 * reassuring ("nobody touched my time today"), so we never hide the section.
 */
export function ChangeLog({ rows, foreignCount, dayDate, tzOffsetHours }: ChangeLogProps) {
  return (
    <section className="mb-7">
      <SectionTitle className="flex items-center gap-2">
        <span>Wat is gewijzigd</span>
        {foreignCount > 0 ? (
          <span className="inline-flex items-center rounded-full bg-bad-bg px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-bad">
            {foreignCount} door iemand anders
          </span>
        ) : null}
      </SectionTitle>

      {rows.length === 0 ? (
        <div className="bg-panel border border-border rounded-xl px-4 py-3 text-[13px] italic text-muted-soft">
          Geen wijzigingen op deze dag
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {rows.map((row) => (
            <ChangeRow
              key={`${row.entry.entryId ?? row.entry.task.id}-${row.edit.at}-${row.edit.action}`}
              row={row}
              dayDate={dayDate}
              tzOffsetHours={tzOffsetHours}
            />
          ))}
        </div>
      )}
    </section>
  );
}
