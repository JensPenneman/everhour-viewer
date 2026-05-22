import type { BackupFile, EverhourProfile, WeekRecord } from "@/lib/everhour";

/**
 * Project the in-browser cache into a {@link BackupFile} suitable for
 * download.
 *
 * The output is deterministic in shape (`schemaVersion: 1`) so that future
 * importers can decide whether they understand the file. The `index` is
 * derived from `weeks` and provided redundantly for tooling that wants a
 * lightweight catalogue without parsing each week.
 */
export function buildBackupFile(
  profile: EverhourProfile | null,
  weeks: ReadonlyArray<WeekRecord>,
): BackupFile {
  const sortedWeeks = [...weeks].sort((a, b) => b.week.from.localeCompare(a.week.from));
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    profile,
    weeks: sortedWeeks,
    index: sortedWeeks.map((w) => ({
      isoWeek: w.week.isoWeek,
      weekId: w.week.weekId,
      from: w.week.from,
      to: w.week.to,
      hours: w.totals.hours,
      status: w.approval.status,
      submittedAt: w.approval.submittedAt,
    })),
  };
}

/**
 * Trigger a browser download of the backup as a single JSON file.
 *
 * Implemented via an in-memory `Blob` and a programmatic `<a download>`
 * click. The data is small enough (a few MB for years of weeks) that
 * streaming to disk isn't necessary; if it ever isn't, a server endpoint
 * with `application/json` streaming would be the next step.
 */
export function downloadBackup(filename: string, backup: BackupFile): void {
  if (typeof window === "undefined") return;
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export interface LoadedBackup {
  readonly profile: EverhourProfile | null;
  readonly weeks: ReadonlyArray<WeekRecord>;
  /** True if at least one valid week was extracted. */
  readonly hasWeeks: boolean;
  /** True if a profile object was extracted. */
  readonly hasProfile: boolean;
}

/**
 * Parse a set of JSON files into a partial cache snapshot.
 *
 * Accepts:
 *   - `profile.json` (or any file matching the heuristic).
 *   - Single-week JSON files (`{ week, days, … }`) — one week each.
 *   - Consolidated backup files (`{ profile, weeks }`).
 *
 * Files that fail to parse or don't match a known shape are silently
 * ignored; callers fall back to "nothing was loaded".
 */
export async function readBackupFiles(files: ReadonlyArray<File>): Promise<LoadedBackup> {
  let profile: EverhourProfile | null = null;
  let hasProfile = false;
  const map = new Map<string, WeekRecord>();

  for (const f of files) {
    if (!f.name.endsWith(".json")) continue;
    try {
      const data = JSON.parse(await f.text()) as Record<string, unknown>;
      if (looksLikeProfile(f.name, data)) {
        profile = data as unknown as EverhourProfile;
        hasProfile = true;
        continue;
      }
      if (f.name === "index.json") continue;
      if (data["profile"] && Array.isArray((data as { weeks?: unknown }).weeks)) {
        profile = data["profile"] as EverhourProfile;
        hasProfile = true;
        for (const w of (data as { weeks: WeekRecord[] }).weeks) {
          map.set(w.week.isoWeek, w);
        }
        continue;
      }
      if (
        (data as { week?: { isoWeek?: unknown } }).week !== undefined &&
        Array.isArray((data as { days?: unknown }).days)
      ) {
        const w = data as unknown as WeekRecord;
        map.set(w.week.isoWeek, w);
      }
    } catch {
      // skip unreadable file
    }
  }

  const weeks = [...map.values()];
  return { profile, weeks, hasProfile, hasWeeks: weeks.length > 0 };
}

function looksLikeProfile(name: string, data: Record<string, unknown>): boolean {
  if (name === "profile.json") return true;
  return (
    data["role"] !== undefined &&
    data["email"] !== undefined &&
    (data as { weeks?: unknown }).weeks === undefined
  );
}
