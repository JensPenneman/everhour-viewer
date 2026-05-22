import { describe, it, expect } from "vitest";
import { buildPlan } from "@/server/sync/plan";
import type { RawTimesheet } from "@/lib/everhour";

function ts(from: string, approval?: RawTimesheet["approval"]): RawTimesheet {
  return {
    user: { id: 1, name: "Tester", email: "t@example.com" },
    week: { id: 1, from, to: from },
    ...(approval ? { approval } : {}),
  };
}

describe("buildPlan", () => {
  it("skips submitted weeks already cached at the same status", () => {
    const plan = buildPlan(
      [ts("2026-05-11", { status: "approved" })],
      [{ isoWeek: "2026-W20", status: "approved" }],
      false,
    );
    expect(plan.toSkip).toHaveLength(1);
    expect(plan.toFetch).toHaveLength(0);
  });

  it("refetches a submitted week when its status has changed", () => {
    const plan = buildPlan(
      [ts("2026-05-11", { status: "approved" })],
      [{ isoWeek: "2026-W20", status: "pending" }],
      false,
    );
    expect(plan.toFetch).toHaveLength(1);
    expect(plan.toSkip).toHaveLength(0);
  });

  it("always refetches open (unsubmitted) weeks", () => {
    const plan = buildPlan(
      [ts("2026-05-18")], // no approval
      [{ isoWeek: "2026-W21", status: "unsubmitted" }],
      false,
    );
    expect(plan.toFetch).toHaveLength(1);
  });

  it("always refetches new weeks the client has never seen", () => {
    const plan = buildPlan([ts("2026-05-04", { status: "approved" })], [], false);
    expect(plan.toFetch).toHaveLength(1);
    expect(plan.toSkip).toHaveLength(0);
  });

  it("force=true overrides skips even for matching cached weeks", () => {
    const plan = buildPlan(
      [ts("2026-05-11", { status: "approved" })],
      [{ isoWeek: "2026-W20", status: "approved" }],
      true,
    );
    expect(plan.toFetch).toHaveLength(1);
    expect(plan.toSkip).toHaveLength(0);
  });

  it("computes the iso week label per entry", () => {
    const plan = buildPlan([ts("2026-05-18")], [], false);
    expect(plan.entries[0]?.isoWeek).toBe("2026-W21");
  });
});
