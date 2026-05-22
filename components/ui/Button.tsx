"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "default" | "primary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly children: ReactNode;
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  default: "bg-[var(--panel)] border-[var(--border)] hover:bg-[var(--hover)]",
  primary: "bg-[var(--accent)] text-white border-[var(--accent)] hover:brightness-110",
  ghost: "bg-transparent border-transparent hover:bg-[var(--hover)]",
  danger: "bg-[var(--bad-bg)] text-[var(--bad)] border-[var(--bad-bg)] hover:brightness-95",
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: "px-2.5 py-1 text-[12px]",
  md: "px-3 py-1.5 text-[13px]",
};

const BASE_CLASS =
  "rounded-md font-medium border transition-colors disabled:opacity-50 " +
  "disabled:cursor-not-allowed cursor-pointer inline-flex items-center gap-1.5";

export function Button({
  variant = "default",
  size = "md",
  type = "button",
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${BASE_CLASS} ${SIZE_CLASS[size]} ${VARIANT_CLASS[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
