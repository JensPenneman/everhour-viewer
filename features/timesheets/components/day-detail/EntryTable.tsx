import { SectionTitle } from "@/shared/ui";
import type { WeekDay } from "@/lib/everhour";
import { fmtDuration, fmtSignedDuration } from "@/lib/format";
import { entryNetEditSeconds, foreignNetEditSeconds } from "./day-audit";
import { EntryRow } from "./EntryRow";

export interface EntryTableProps {
  readonly day: WeekDay;
  readonly ownerId: number;
  readonly tzOffsetHours: number | null;
}

/**
 * The "Per ticket" table — one expandable row per time entry, with totals.
 * Click a row to reveal its full edit history.
 */
export function EntryTable({ day, ownerId, tzOffsetHours }: EntryTableProps) {
  const netTotal = day.entries.reduce((acc, e) => acc + entryNetEditSeconds(e), 0);
  // Colour the day total red only when *someone else's* net edit removed time
  // — the owner trimming their own time must never read as a boss correction.
  const foreignNetTotal = day.entries.reduce(
    (acc, e) => acc + foreignNetEditSeconds(e, ownerId),
    0,
  );

  return (
    <section className="mb-2">
      <SectionTitle>Per ticket</SectionTitle>

      {day.entries.length === 0 ? (
        <div className="bg-panel border border-border rounded-xl px-4 py-3 text-[13px] italic text-muted-soft">
          Geen tijdregistraties
        </div>
      ) : (
        <div className="bg-panel border border-border rounded-xl overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#fafafa]">
                <Th className="w-[120px]">Ticket</Th>
                <Th>Titel</Th>
                <Th className="w-[90px] text-right">Getrackt</Th>
                <Th className="w-[100px] text-right">Wijziging</Th>
                <Th className="w-[120px]">Door</Th>
              </tr>
            </thead>
            <tbody>
              {day.entries.map((entry) => (
                <EntryRow
                  key={entry.entryId ?? `${entry.task.id}-${entry.seconds}`}
                  entry={entry}
                  ownerId={ownerId}
                  tzOffsetHours={tzOffsetHours}
                />
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-[#fafafa] font-semibold">
                <td
                  className="px-4 py-2.5 text-[12px] uppercase tracking-wider text-muted"
                  colSpan={2}
                >
                  Totaal
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-[13px]">
                  {fmtDuration(day.totalSeconds)}
                </td>
                <td
                  className={`px-4 py-2.5 text-right tabular-nums text-[13px] ${
                    netTotal === 0
                      ? "text-muted"
                      : foreignNetTotal < 0
                        ? "text-bad"
                        : "text-foreground"
                  }`}
                >
                  {netTotal === 0 ? "—" : fmtSignedDuration(netTotal)}
                </td>
                <td className="px-4 py-2.5" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`px-4 py-2.5 text-left border-b border-border text-[11px] uppercase tracking-wider text-muted font-medium ${className}`}
    >
      {children}
    </th>
  );
}
