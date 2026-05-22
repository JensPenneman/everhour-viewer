"use client";

import { useEffect, useRef, type ReactNode } from "react";

export interface MenuProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly anchor: ReactNode;
  readonly children: ReactNode;
}

/**
 * Anchored dropdown menu. Closes on outside click and Escape.
 *
 * Positioning is naive (right-aligned, below anchor); good enough for the
 * single overflow menu in the header. If the project grows more menus a
 * floating-ui-style wrapper would be the next step.
 */
export function Menu({ open, onClose, anchor, children }: MenuProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <div className="relative" ref={ref}>
      {anchor}
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1.5 min-w-[220px] bg-[var(--panel)] border border-[var(--border)] rounded-lg shadow-lg z-40 py-1.5 overflow-hidden"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

export interface MenuItemProps {
  readonly onClick: () => void;
  readonly disabled?: boolean;
  readonly danger?: boolean;
  readonly children: ReactNode;
}

export function MenuItem({ onClick, disabled, danger, children }: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={`w-full text-left px-3.5 py-2 text-[13px] disabled:opacity-40 disabled:cursor-not-allowed ${
        danger ? "text-[var(--bad)] hover:bg-[var(--bad-bg)]" : "hover:bg-[var(--hover)]"
      }`}
    >
      {children}
    </button>
  );
}

export function MenuDivider() {
  return <div role="separator" className="border-t border-[var(--border)] my-1" />;
}
