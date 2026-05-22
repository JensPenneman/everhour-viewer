import { describe, it, expect } from "vitest";
import { SyncRequestSchema } from "@/server/sync/schema";

describe("SyncRequestSchema", () => {
  it("accepts an empty body and applies defaults", () => {
    const parsed = SyncRequestSchema.parse({});
    expect(parsed.weeksBack).toBe(78);
    expect(parsed.force).toBe(false);
    expect(parsed.knownWeeks).toEqual([]);
  });

  it("rejects an unknown property in strict mode", () => {
    const result = SyncRequestSchema.safeParse({ rogue: true });
    expect(result.success).toBe(false);
  });

  it("rejects weeksBack outside [1, 260]", () => {
    expect(SyncRequestSchema.safeParse({ weeksBack: 0 }).success).toBe(false);
    expect(SyncRequestSchema.safeParse({ weeksBack: 261 }).success).toBe(false);
    expect(SyncRequestSchema.safeParse({ weeksBack: 78 }).success).toBe(true);
  });

  it("rejects malformed isoWeek labels", () => {
    const bad = SyncRequestSchema.safeParse({
      knownWeeks: [{ isoWeek: "2026-W5", status: "approved" }], // not zero-padded
    });
    expect(bad.success).toBe(false);

    const good = SyncRequestSchema.safeParse({
      knownWeeks: [{ isoWeek: "2026-W05", status: "approved" }],
    });
    expect(good.success).toBe(true);
  });

  it("rejects unknown approval statuses", () => {
    const result = SyncRequestSchema.safeParse({
      knownWeeks: [{ isoWeek: "2026-W05", status: "wishful" }],
    });
    expect(result.success).toBe(false);
  });
});
