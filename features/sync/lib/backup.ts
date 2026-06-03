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
    if (!f.name.endsWith(".json") || f.name === "index.json") continue;

    let data: unknown;
    try {
      data = JSON.parse(await f.text());
    } catch {
      continue; // skip unreadable / malformed file
    }
    if (!isRecord(data)) continue;

    // Consolidated backup: `{ profile, weeks }`.
    if (Array.isArray(data["weeks"])) {
      const p = data["profile"];
      if (isProfile(p)) {
        profile = p;
        hasProfile = true;
      }
      for (const w of data["weeks"]) {
        if (isWeekRecord(w)) map.set(w.week.isoWeek, w);
      }
      continue;
    }

    // Standalone profile file.
    if (isProfile(data)) {
      profile = data;
      hasProfile = true;
      continue;
    }

    // Single-week file (`{ week, days, … }`).
    if (isWeekRecord(data)) map.set(data.week.isoWeek, data);
  }

  const weeks = [...map.values()];
  return { profile, weeks, hasProfile, hasWeeks: weeks.length > 0 };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Structural check that an imported value is a stored {@link WeekRecord}.
 *
 * Validates the discriminating fields the cache keys on (`week.isoWeek`, a
 * `days` array) rather than every leaf — imported data is trusted to the same
 * degree the in-browser cache is, but a near-miss file is rejected instead of
 * being blindly cast into the cache.
 */
function isWeekRecord(v: unknown): v is WeekRecord {
  if (!isRecord(v)) return false;
  const week = v["week"];
  return isRecord(week) && typeof week["isoWeek"] === "string" && Array.isArray(v["days"]);
}

/**
 * Structural check that an imported value is a stored {@link EverhourProfile}.
 *
 * A {@link WeekRecord} also carries a `user` object with id/name/email, so we
 * discriminate on the keys only a profile/backup has and a week never does:
 * neither a `week` (single-week file) nor a `weeks` (consolidated) key.
 */
function isProfile(v: unknown): v is EverhourProfile {
  return (
    isRecord(v) &&
    typeof v["id"] === "number" &&
    typeof v["name"] === "string" &&
    typeof v["email"] === "string" &&
    !("week" in v) &&
    !("weeks" in v)
  );
}
