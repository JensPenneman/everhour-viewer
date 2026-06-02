"use client";

import { useMemo, useState } from "react";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { fmtDuration } from "@/lib/format";
import type { TaskTotal } from "./utils";

export interface TaskTableProps {
  readonly tasks: ReadonlyArray<TaskTotal>;
}

/** Per-column cell/header classes, keyed by column id (kept out of the column defs for type simplicity). */
const TH_CLASS: Record<string, string> = {
  ticket: "w-[100px]",
  time: "w-[90px] text-right",
};
const TD_CLASS: Record<string, string> = {
  ticket: "text-muted tabular-nums whitespace-nowrap font-medium text-[12.5px]",
  title: "text-[13.5px]",
  time: "text-right tabular-nums text-[13px]",
};

const columns: ColumnDef<TaskTotal>[] = [
  {
    id: "ticket",
    header: "Ticket",
    accessorFn: (t) => t.task.linearKey ?? "",
    cell: ({ row }) => {
      const t = row.original.task;
      return t.url ? (
        <a
          href={t.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline"
        >
          {t.linearKey || ""}
        </a>
      ) : (
        (t.linearKey ?? "")
      );
    },
  },
  {
    id: "title",
    header: "Titel",
    accessorFn: (t) => t.task.name,
    cell: ({ row }) => row.original.task.name,
  },
  {
    id: "time",
    header: "Tijd",
    accessorFn: (t) => t.seconds,
    cell: ({ row }) => fmtDuration(row.original.seconds),
  },
];

/** Per-task hours for the week — sortable by ticket / title / time. */
export function TaskTable({ tasks }: TaskTableProps) {
  // Default to the incoming order (descending duration from aggregateTasks).
  const [sorting, setSorting] = useState<SortingState>([{ id: "time", desc: true }]);
  const data = useMemo(() => [...tasks], [tasks]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (t) => t.task.id,
  });

  const rows = table.getRowModel().rows;

  return (
    <div className="bg-panel border border-border rounded-xl overflow-hidden mb-7">
      <table className="w-full border-collapse">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id} className="bg-[#fafafa]">
              {hg.headers.map((header) => {
                const sorted = header.column.getIsSorted();
                return (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className={`cursor-pointer select-none px-4 py-2.5 text-left border-b border-border text-[11px] uppercase tracking-wider text-muted font-medium ${TH_CLASS[header.column.id] ?? ""}`}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {sorted ? (
                      <span aria-hidden="true">{sorted === "asc" ? " ▲" : " ▼"}</span>
                    ) : null}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr
              key={row.id}
              className={`hover:bg-[#fafbfc] ${idx === rows.length - 1 ? "" : "border-b border-border"}`}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className={`px-4 py-2.5 ${TD_CLASS[cell.column.id] ?? ""}`}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
