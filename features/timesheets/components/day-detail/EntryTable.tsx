"use client";

import { Fragment, useMemo, useState } from "react";
import {
  type ColumnDef,
  type ExpandedState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { SectionTitle } from "@/shared/ui";
import type { WeekDay, WeekEntry } from "@/lib/everhour";
import { fmtDuration, fmtSignedDuration } from "@/lib/format";
import { CorrectionPill } from "./CorrectionPill";
import {
  entryNetEditSeconds,
  entryWasCorrectedByOther,
  foreignNetEditSeconds,
  isForeignActor,
  resolveActorLabel,
} from "./day-audit";
import { HistoryLedger } from "./HistoryLedger";

export interface EntryTableProps {
  readonly day: WeekDay;
  readonly ownerId: number;
  readonly tzOffsetHours: number | null;
}

const TH_CLASS: Record<string, string> = {
  ticket: "w-[120px]",
  getrackt: "w-[90px] text-right",
  wijziging: "w-[100px] text-right",
  door: "w-[120px]",
};
const TD_CLASS: Record<string, string> = {
  ticket: "text-muted tabular-nums whitespace-nowrap font-medium text-[12.5px]",
  title: "text-[13.5px]",
  getrackt: "text-right tabular-nums text-[13px]",
  wijziging: "text-right tabular-nums text-[13px] font-medium",
  door: "text-[12.5px] whitespace-nowrap",
};

/**
 * The "Per ticket" table — one expandable row per time entry, with totals.
 * Click a row to reveal its full edit history. Expansion is managed by
 * TanStack Table (`getExpandedRowModel`); a foreign correction marks the row
 * with a red inset bar and a `⚠ {actor}` badge in the DOOR column.
 */
export function EntryTable({ day, ownerId, tzOffsetHours }: EntryTableProps) {
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const data = useMemo(() => [...day.entries], [day.entries]);

  const columns = useMemo<ColumnDef<WeekEntry>[]>(
    () => [
      {
        id: "ticket",
        header: "Ticket",
        cell: ({ row }) => {
          const entry = row.original;
          return (
            <span className="inline-flex items-center gap-1.5">
              {row.getCanExpand() ? (
                <svg
                  width="9"
                  height="9"
                  viewBox="0 0 10 10"
                  className={`text-muted-soft transition-transform ${row.getIsExpanded() ? "rotate-90" : ""}`}
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M3 1l4 4-4 4z" />
                </svg>
              ) : (
                <span className="w-[9px]" aria-hidden="true" />
              )}
              {entry.task.url ? (
                <a
                  href={entry.task.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {entry.task.linearKey || ""}
                </a>
              ) : (
                (entry.task.linearKey ?? "")
              )}
            </span>
          );
        },
      },
      { id: "title", header: "Titel", cell: ({ row }) => row.original.task.name },
      {
        id: "getrackt",
        header: "Getrackt",
        cell: ({ row }) => fmtDuration(row.original.seconds),
      },
      {
        id: "wijziging",
        header: "Wijziging",
        cell: ({ row }) => {
          const entry = row.original;
          const netEdit = entryNetEditSeconds(entry);
          if (netEdit === 0) return <span className="text-muted">—</span>;
          const correctedByOther = entryWasCorrectedByOther(entry, ownerId);
          const ownerEdited = (entry.history ?? []).some(
            (h) => h.action === "EDIT" && !isForeignActor(h.by, ownerId),
          );
          const color = correctedByOther
            ? foreignNetEditSeconds(entry, ownerId) < 0
              ? "text-bad"
              : "text-warn"
            : ownerEdited
              ? "text-accent"
              : "text-muted";
          return <span className={color}>{fmtSignedDuration(netEdit)}</span>;
        },
      },
      {
        id: "door",
        header: "Door",
        cell: ({ row }) => {
          const entry = row.original;
          const history = entry.history ?? [];
          const correctedByOther = entryWasCorrectedByOther(entry, ownerId);
          const foreignActor = history.find(
            (h) => (h.action === "EDIT" || h.action === "COMMENT") && isForeignActor(h.by, ownerId),
          );
          const ownerEdited = history.some(
            (h) => h.action === "EDIT" && !isForeignActor(h.by, ownerId),
          );
          if (correctedByOther && foreignActor) {
            const tone = foreignNetEditSeconds(entry, ownerId) < 0 ? "bad" : "warn";
            return (
              <CorrectionPill
                tone={tone}
                title={`Gewijzigd door ${resolveActorLabel(foreignActor.byName, foreignActor.by)}`}
              >
                ⚠ {shortName(foreignActor.byName, foreignActor.by)}
              </CorrectionPill>
            );
          }
          return ownerEdited ? (
            <span className="text-muted">Jij</span>
          ) : (
            <span className="text-muted-soft">—</span>
          );
        },
      },
    ],
    [ownerId],
  );

  const table = useReactTable({
    data,
    columns,
    state: { expanded },
    onExpandedChange: setExpanded,
    getRowCanExpand: (row) => (row.original.history?.length ?? 0) > 0,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowId: (e) => (e.entryId != null ? `e${e.entryId}` : `${e.task.id}-${e.seconds}`),
  });

  const netTotal = day.entries.reduce((acc, e) => acc + entryNetEditSeconds(e), 0);
  // Colour the day total red only when *someone else's* net edit removed time —
  // the owner trimming their own time must never read as a boss correction.
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
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="bg-[#fafafa]">
                  {hg.headers.map((header) => (
                    <th
                      key={header.id}
                      className={`px-4 py-2.5 text-left border-b border-border text-[11px] uppercase tracking-wider text-muted font-medium ${TH_CLASS[header.column.id] ?? ""}`}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => {
                const correctedByOther = entryWasCorrectedByOther(row.original, ownerId);
                const tone = foreignNetEditSeconds(row.original, ownerId) < 0 ? "bad" : "warn";
                return (
                  <Fragment key={row.id}>
                    <tr
                      className={`${row.getCanExpand() ? "cursor-pointer" : ""} hover:bg-[#fafbfc] border-b border-border`}
                      onClick={row.getCanExpand() ? row.getToggleExpandedHandler() : undefined}
                      style={
                        correctedByOther ? { boxShadow: `inset 3px 0 0 var(--${tone})` } : undefined
                      }
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          className={`px-4 py-2.5 ${TD_CLASS[cell.column.id] ?? ""}`}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                    {row.getIsExpanded() ? (
                      <tr>
                        <td colSpan={5} className="px-4 pb-3 pt-0 bg-[#fafbfc]">
                          <HistoryLedger
                            entry={row.original}
                            ownerId={ownerId}
                            tzOffsetHours={tzOffsetHours}
                          />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
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

/** "Thomas Blommaert" → "Thomas B."; falls back to "#id" then a generic label. */
function shortName(full: string | null, by: number | null): string {
  if (!full) return by != null ? `#${by}` : "iemand anders";
  const parts = full.trim().split(/\s+/);
  if (parts.length < 2) return full;
  return `${parts[0]} ${parts[parts.length - 1]![0]!.toUpperCase()}.`;
}
