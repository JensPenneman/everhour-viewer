import type { TimeEdit, WeekEntry } from "@/lib/everhour";
import { fmtDuration, fmtLocalTime, fmtSignedDuration } from "@/lib/format";
import { isForeignActor, resolveActorLabel } from "./day-audit";

export interface HistoryLedgerProps {
  readonly entry: WeekEntry;
  readonly ownerId: number;
  readonly tzOffsetHours: number | null;
}

const ACTION_META: Record<TimeEdit["action"], { icon: string; label: string }> = {
  TIMER: { icon: "⏱", label: "Timer" },
  EDIT: { icon: "✎", label: "Correctie" },
  COMMENT: { icon: "💬", label: "Opmerking" },
};

const ACTION_ORDER: Record<TimeEdit["action"], number> = { TIMER: 0, EDIT: 1, COMMENT: 2 };

/**
 * The full audit trail for one entry: timer runs, manual corrections, and
 * comments in chronological order, with the running cumulative taken
 * straight from the data (`previousSeconds + deltaSeconds`) rather than a
 * re-sum — time moved in from another task breaks naive sums.
 */
export function HistoryLedger({ entry, ownerId, tzOffsetHours }: HistoryLedgerProps) {
  const history = [...(entry.history ?? [])]
    .map((h, i) => ({ h, i }))
    .sort(
      (a, b) =>
        a.h.at.localeCompare(b.h.at) ||
        ACTION_ORDER[a.h.action] - ACTION_ORDER[b.h.action] ||
        a.i - b.i,
    )
    .map(({ h }) => h);

  if (history.length === 0) {
    return (
      <div className="text-[12px] text-muted-soft italic py-1">
        Geen wijzigingsgeschiedenis beschikbaar
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-[#fafbfc] overflow-hidden">
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="text-muted">
            <Th>Tijd</Th>
            <Th>Actie</Th>
            <Th className="text-right">Δ</Th>
            <Th className="text-right">Cumulatief</Th>
            <Th>Door</Th>
            <Th>Opmerking</Th>
          </tr>
        </thead>
        <tbody>
          {history.map((h, idx) => {
            const meta = ACTION_META[h.action];
            const foreign = isForeignActor(h.by, ownerId);
            const isComment = h.action === "COMMENT";
            const cumulative = h.previousSeconds + h.deltaSeconds;
            // Red is reserved for a foreign REDUCTION; a foreign addition or
            // a foreign comment/timer is amber, an owner edit is accent.
            const foreignReduction = foreign && h.action === "EDIT" && h.deltaSeconds < 0;
            const deltaColor =
              h.action === "EDIT"
                ? foreign
                  ? h.deltaSeconds < 0
                    ? "text-bad"
                    : "text-warn"
                  : "text-accent"
                : "text-muted";
            const rowBg = foreignReduction
              ? "bg-bad-bg"
              : foreign && !isComment
                ? "bg-warn-bg"
                : "";
            const actorColor = foreignReduction
              ? "text-bad font-medium"
              : foreign
                ? "text-warn font-medium"
                : "text-muted";
            return (
              <tr key={idx} className={`border-t border-border ${rowBg}`}>
                <Td className="tabular-nums text-muted whitespace-nowrap">
                  {fmtLocalTime(h.at, tzOffsetHours) || "—"}
                </Td>
                <Td className="whitespace-nowrap">
                  <span aria-hidden="true">{meta.icon}</span> {meta.label}
                </Td>
                <Td className={`text-right tabular-nums font-medium ${deltaColor}`}>
                  {isComment ? "—" : fmtSignedDuration(h.deltaSeconds)}
                </Td>
                <Td className="text-right tabular-nums text-muted">→ {fmtDuration(cumulative)}</Td>
                <Td className={`whitespace-nowrap ${actorColor}`}>
                  {foreign ? resolveActorLabel(h.byName, h.by) : "Jij"}
                </Td>
                <Td className="text-foreground">
                  {isComment && entry.comment ? `“${entry.comment}”` : ""}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`px-3 py-1.5 text-left font-medium text-[10.5px] uppercase tracking-wider ${className}`}
    >
      {children}
    </th>
  );
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-1.5 ${className}`}>{children}</td>;
}
