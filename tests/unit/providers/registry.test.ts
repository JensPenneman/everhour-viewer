import { describe, it, expect } from "vitest";
import { PROVIDERS, providerById } from "@/lib/providers";

describe("provider registry", () => {
  it("has at least the holidays + ICS providers", () => {
    const ids = PROVIDERS.map((p) => p.meta.id);
    expect(ids).toContain("holidays:be");
    expect(ids).toContain("ics:imported");
  });

  it("every provider has a unique id", () => {
    const ids = PROVIDERS.map((p) => p.meta.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every provider declares the full ProviderMeta shape", () => {
    for (const p of PROVIDERS) {
      expect(p.meta.id).toBeTruthy();
      expect(p.meta.name).toBeTruthy();
      expect(p.meta.description).toBeTruthy();
      expect(p.meta.category).toBeTruthy();
      expect(p.meta.icon).toBeTruthy();
    }
  });

  it("providerById finds a known provider and undefined for unknown", () => {
    expect(providerById("holidays:be")?.meta.id).toBe("holidays:be");
    expect(providerById("never-existed")).toBeUndefined();
  });

  it("holidays:be is ready by default and ics:imported is not (no upload yet)", () => {
    expect(providerById("holidays:be")?.status().ready).toBe(true);
    expect(providerById("ics:imported")?.status().ready).toBe(false);
  });

  it("holidays:be returns Belgian holidays for a given range", async () => {
    const holidays = providerById("holidays:be");
    expect(holidays).toBeDefined();
    const events = await holidays!.fetchEvents({ from: "2026-01-01", to: "2026-12-31" });
    expect(events.some((e) => e.date === "2026-01-01")).toBe(true);
    expect(events.every((e) => e.source === "holidays:be")).toBe(true);
  });

  it("an inactive provider yields an empty list via fetchEvents (sanity)", async () => {
    const ics = providerById("ics:imported");
    expect(ics).toBeDefined();
    const events = await ics!.fetchEvents({ from: "2026-01-01", to: "2026-12-31" });
    expect(events).toEqual([]);
  });
});
