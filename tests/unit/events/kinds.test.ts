import { describe, it, expect } from "vitest";
import { DAY_EVENT_KINDS, dayEventKindMeta } from "@/lib/events/kinds";

describe("dayEventKindMeta", () => {
  it("returns metadata for every defined kind", () => {
    for (const meta of DAY_EVENT_KINDS) {
      const looked = dayEventKindMeta(meta.kind);
      expect(looked.kind).toBe(meta.kind);
      expect(looked.label.length).toBeGreaterThan(0);
      expect(looked.emoji.length).toBeGreaterThan(0);
    }
  });

  it("falls back to `other` for unrecognised values", () => {
    // @ts-expect-error – deliberately bad input
    const meta = dayEventKindMeta("definitely-not-a-kind");
    expect(meta.kind).toBe("other");
  });

  it("covers the five expected kinds in display order", () => {
    expect(DAY_EVENT_KINDS.map((m) => m.kind)).toEqual([
      "holiday",
      "leave",
      "sick",
      "office_closed",
      "other",
    ]);
  });
});
