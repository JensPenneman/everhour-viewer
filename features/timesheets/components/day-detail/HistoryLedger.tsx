"use client";

import { useMemo } from "react";
import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
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

const TD_CLASS: Record<string, string> = {
  tijd: "tabular-nums text-muted whitespace-nowrap",
  actie: "whitespace-nowrap",
  delta: "text-right tabular-nums font-medium",
  cumulatief: "text-right tabular-nums text-muted",
  door: "whitespace-nowrap",
  opmerking: "text-foreground",
};
const TH_CLASS: Record<string, string> = { delta: "text-right", cumulatief: "text-right" };

/**
 * The full audit trail for one entry: timer runs, manual corrections, and
 * comments in chronological order, with the running cumulative taken straight
 * from the data (`previousSeconds + deltaSeconds`) rather than a re-sum — time
 * moved in from another task breaks naive sums.
 *
 * Built with TanStack Table for the row/column model; the order is a fixed
 * multi-key sort (time → action → original index), so no interactive sorting.
 */
export function HistoryLedger({ entry, ownerId, tzOffsetHours }: HistoryLedgerProps) {
  const data = useMemo(
    () =>
      [...(entry.history ?? [])]
        .map((h, i) => ({ h, i }))
        .sort(
          (a, b) =>
            a.h.at.localeCompare(b.h.at) ||
            ACTION_ORDER[a.h.action] - ACTION_ORDER[b.h.action] ||
            a.i - b.i,
        )
        .map(({ h }) => h),
    [entry.history],
  );

  const columns = useMemo<ColumnDef<TimeEdit>[]>(
    () => [
      {
        id: "tijd",
        header: "Tijd",
        cell: ({ row }) => fmtLocalTime(row.original.at, tzOffsetHours) || "—",
      },
      {
        id: "actie",
        header: "Actie",
        cell: ({ row }) => {
          const meta = ACTION_META[row.original.action];
          return (
            <>
              <span aria-hidden="true">{meta.icon}</span> {meta.label}
            </>
          );
        },
      },
      {
        id: "delta",
        header: "Δ",
        cell: ({ row }) => {
          const h = row.original;
          if (h.action === "COMMENT") return <span className="text-muted">—</span>;
          const color =
            h.action === "EDIT"
              ? isForeignActor(h.by, ownerId)
                ? h.deltaSeconds < 0
                  ? "text-bad"
                  : "text-warn"
                : "text-accent"
              : "text-muted";
          return <span className={color}>{fmtSignedDuration(h.deltaSeconds)}</span>;
        },
      },
      {
        id: "cumulatief",
        header: "Cumulatief",
        cell: ({ row }) =>
          `→ ${fmtDuration(row.original.previousSeconds + row.original.deltaSeconds)}`,
      },
      {
        id: "door",
        header: "Door",
        cell: ({ row }) => {
          const h = row.original;
          const foreign = isForeignActor(h.by, ownerId);
          const foreignReduction = foreign && h.action === "EDIT" && h.deltaSeconds < 0;
          const color = foreignReduction
            ? "text-bad font-medium"
            : foreign
              ? "text-warn font-medium"
              : "text-muted";
          return (
            <span className={color}>{foreign ? resolveActorLabel(h.byName, h.by) : "Jij"}</span>
          );
        },
      },
      {
        id: "opmerking",
        header: "Opmerking",
        cell: ({ row }) =>
          row.original.action === "COMMENT" && entry.comment ? `“${entry.comment}”` : "",
      },
    ],
    [ownerId, tzOffsetHours, entry.comment],
  );

  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });

  if (data.length === 0) {
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
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id} className="text-muted">
              {hg.headers.map((header) => (
                <th
                  key={header.id}
                  className={`px-3 py-1.5 text-left font-medium text-[10.5px] uppercase tracking-wider ${TH_CLASS[header.column.id] ?? ""}`}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => {
            const h = row.original;
            const foreign = isForeignActor(h.by, ownerId);
            const foreignReduction = foreign && h.action === "EDIT" && h.deltaSeconds < 0;
            const rowBg = foreignReduction
              ? "bg-bad-bg"
              : foreign && h.action !== "COMMENT"
                ? "bg-warn-bg"
                : "";
            return (
              <tr key={row.id} className={`border-t border-border ${rowBg}`}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className={`px-3 py-1.5 ${TD_CLASS[cell.column.id] ?? ""}`}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
