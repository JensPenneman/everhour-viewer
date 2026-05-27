"use client";

import { useState } from "react";
import { Menu, MenuItem } from "@/components/ui";
import { DAY_EVENT_KINDS, type DayEventKind } from "@/lib/events";

export interface AddEventControlProps {
  readonly onPick: (kind: DayEventKind) => void;
  readonly label?: string;
}

/**
 * Tiny `+ Markeer als …` button that opens a kind-picker menu. Used
 * inside an expanded day row in the breakdown.
 */
export function AddEventControl({ onPick, label = "+ Markeer als…" }: AddEventControlProps) {
  const [open, setOpen] = useState(false);

  return (
    <Menu
      open={open}
      onClose={() => setOpen(false)}
      anchor={
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="text-[12px] text-muted hover:text-accent transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-bg rounded"
          aria-haspopup="menu"
          aria-expanded={open}
        >
          {label}
        </button>
      }
    >
      {DAY_EVENT_KINDS.map((meta) => (
        <MenuItem
          key={meta.kind}
          onClick={() => {
            onPick(meta.kind);
            setOpen(false);
          }}
        >
          <span className="mr-2" aria-hidden="true">
            {meta.emoji}
          </span>
          {meta.label}
        </MenuItem>
      ))}
    </Menu>
  );
}
