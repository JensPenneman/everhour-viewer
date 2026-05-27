"use client";

import { fmtHours } from "@/lib/format";
import type { TaskTotal } from "./utils";

export interface TaskTableProps {
  readonly tasks: ReadonlyArray<TaskTotal>;
}

export function TaskTable({ tasks }: TaskTableProps) {
  return (
    <div className="bg-panel border border-border rounded-xl overflow-hidden mb-7">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-[#fafafa]">
            <Th className="w-[100px]">Ticket</Th>
            <Th>Titel</Th>
            <Th className="w-[90px] text-right">Uren</Th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t, idx) => (
            <tr
              key={t.task.id}
              className={`hover:bg-[#fafbfc] ${
                idx === tasks.length - 1 ? "" : "border-b border-border"
              }`}
            >
              <td className="px-4 py-2.5 text-muted tabular-nums whitespace-nowrap font-medium text-[12.5px]">
                {t.task.url ? (
                  <a
                    href={t.task.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline"
                  >
                    {t.task.linearKey || ""}
                  </a>
                ) : (
                  t.task.linearKey || ""
                )}
              </td>
              <td className="px-4 py-2.5 text-[13.5px]">{t.task.name}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-[13px]">
                {fmtHours(t.seconds)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
