/**
 * Dutch-language formatters and labels.
 *
 * Centralised so the UI never sprinkles language strings inline; everything
 * routes through this module. If the app ever needs another locale it's a
 * single drop-in.
 */

import type { ApprovalStatus } from "@/lib/everhour";

const NL_WEEKDAY = [
  "zondag",
  "maandag",
  "dinsdag",
  "woensdag",
  "donderdag",
  "vrijdag",
  "zaterdag",
] as const;

const NL_MONTH_SHORT = [
  "jan",
  "feb",
  "mrt",
  "apr",
  "mei",
  "jun",
  "jul",
  "aug",
  "sep",
  "okt",
  "nov",
  "dec",
] as const;

export function nlWeekday(date: Date): string {
  return NL_WEEKDAY[date.getDay()] ?? "";
}

export function nlMonthShort(monthIndex: number): string {
  return NL_MONTH_SHORT[monthIndex] ?? "";
}

const STATUS_LABEL: Record<ApprovalStatus, string> = {
  pending: "in afwachting",
  approved: "goedgekeurd",
  rejected: "afgekeurd",
  unsubmitted: "open",
};

export function statusLabel(status: ApprovalStatus | string): string {
  return STATUS_LABEL[status as ApprovalStatus] ?? status;
}

export function capitalize(s: string): string {
  if (s.length === 0) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
