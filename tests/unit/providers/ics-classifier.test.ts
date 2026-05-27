import { describe, it, expect } from "vitest";
import { classifySummary } from "@/lib/providers/ics/classifier";

describe("classifySummary", () => {
  it.each([
    ["Annual leave", "leave"],
    ["PTO – August", "leave"],
    ["Out of office", "leave"],
    ["Verlof zomer", "leave"],
    ["Sick day", "sick"],
    ["Ziek", "sick"],
    ["Public holiday", "holiday"],
    ["Pinkstermaandag (feestdag)", "holiday"],
    ["Office closed for renovation", "office_closed"],
    ["Sprint planning", "other"],
    ["", "other"],
  ])("classifies %s as %s", (summary, expected) => {
    expect(classifySummary(summary)).toBe(expected);
  });
});
