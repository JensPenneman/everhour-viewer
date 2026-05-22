/**
 * Domain types for the Everhour viewer.
 *
 * These types are the canonical shape of data both at rest (in
 * `localStorage` / on-disk backups) and over the wire (NDJSON sync events).
 * They are intentionally narrower than Everhour's own API payloads — the
 * server sanitises into these shapes before sending them to the client.
 */

export type ApprovalStatus = "pending" | "approved" | "rejected" | "unsubmitted";

export interface EverhourProfile {
  readonly schemaVersion: 1;
  readonly exportedAt: string;
  readonly id: number;
  readonly name: string;
  readonly email: string;
  readonly role: string | null;
  readonly headline: string | null;
  readonly status: string | null;
  readonly avatarUrl: string | null;
  readonly avatarUrlLarge: string | null;
  readonly timezone: number | null;
  readonly capacity: number | null;
  readonly cost: number | null;
  readonly costHistory: unknown;
  readonly createdAt: string | null;
  readonly groups: ReadonlyArray<{ readonly id: number; readonly name: string }> | null;
}

export interface WeekTaskRef {
  readonly id: string;
  readonly name: string;
  readonly linearKey: string | null;
  readonly url: string | null;
  readonly labels: ReadonlyArray<string>;
}

export interface WeekEntry {
  readonly task: WeekTaskRef;
  readonly seconds: number;
  readonly lockReasons: ReadonlyArray<string>;
}

export interface WeekDay {
  readonly date: string;
  readonly weekday: string;
  readonly totalSeconds: number;
  readonly entries: ReadonlyArray<WeekEntry>;
  readonly clockIn?: string | null;
  readonly clockOut?: string | null;
  readonly workTime?: number | null;
  readonly breakTime?: number | null;
}

export interface ApprovalEvent {
  readonly action: string;
  readonly createdAt: string;
}

export interface WeekRecord {
  readonly schemaVersion: 2;
  readonly exportedAt: string;
  readonly user: { readonly id: number; readonly name: string; readonly email: string };
  readonly week: {
    readonly isoWeek: string;
    readonly weekId: number;
    readonly from: string;
    readonly to: string;
  };
  readonly approval: {
    readonly status: ApprovalStatus;
    readonly submittedAt: string | null;
    readonly history: ReadonlyArray<ApprovalEvent>;
  };
  readonly totals: { readonly seconds: number; readonly hours: number };
  readonly days: ReadonlyArray<WeekDay>;
}

/** Backup file written by the in-browser "Backup downloaden" action. */
export interface BackupFile {
  readonly schemaVersion: 1;
  readonly exportedAt: string;
  readonly profile: EverhourProfile | null;
  readonly weeks: ReadonlyArray<WeekRecord>;
  readonly index: ReadonlyArray<{
    readonly isoWeek: string;
    readonly weekId: number;
    readonly from: string;
    readonly to: string;
    readonly hours: number;
    readonly status: ApprovalStatus;
    readonly submittedAt: string | null;
  }>;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Raw Everhour API shapes — only consumed by lib/everhour/transforms.ts.   */
/* Kept here so the surface is documented; not re-exported.                 */
/* ────────────────────────────────────────────────────────────────────────── */

export interface RawTask {
  readonly id: string;
  readonly name: string;
  readonly number?: string | null;
  readonly url?: string | null;
  readonly labels?: ReadonlyArray<string>;
}

export interface RawEntry {
  readonly date: string;
  readonly time: number;
  readonly task: RawTask;
  readonly lockReasons?: ReadonlyArray<string>;
}

export interface RawTimecard {
  readonly date: string;
  readonly clockIn?: string | null;
  readonly clockOut?: string | null;
  readonly workTime?: number | null;
  readonly breakTime?: number | null;
}

export interface RawTimesheet {
  readonly user: { readonly id: number; readonly name: string; readonly email: string };
  readonly week: { readonly id: number; readonly from: string; readonly to: string };
  readonly dailyTime?: Readonly<Record<string, number>>;
  readonly timecards?: ReadonlyArray<RawTimecard>;
  readonly approval?: {
    readonly status: ApprovalStatus;
    readonly history?: ReadonlyArray<ApprovalEvent>;
  };
}
