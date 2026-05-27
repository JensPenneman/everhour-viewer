import { describe, it, expect } from "vitest";
import { icsToDayEvents } from "@/lib/providers/ics";

const ICS = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:1@x
SUMMARY:Verlof
DTSTART;VALUE=DATE:20260615
STATUS:CONFIRMED
END:VEVENT
BEGIN:VEVENT
UID:2@x
SUMMARY:Cancelled day
DTSTART;VALUE=DATE:20260616
STATUS:CANCELLED
END:VEVENT
BEGIN:VEVENT
UID:3@x
SUMMARY:Daily standup
DTSTART:20260617T093000Z
DTEND:20260617T094500Z
END:VEVENT
END:VCALENDAR
`;

describe("icsToDayEvents", () => {
  it("drops timed events and cancelled events", () => {
    const events = icsToDayEvents(ICS);
    expect(events).toHaveLength(1);
    expect(events[0]?.date).toBe("2026-06-15");
    expect(events[0]?.label).toBe("Verlof");
    expect(events[0]?.kind).toBe("leave");
    expect(events[0]?.source).toBe("ics:imported");
  });

  it("produces stable ids that include the source date", () => {
    const events = icsToDayEvents(ICS);
    expect(events[0]?.id).toContain("ics:imported");
    expect(events[0]?.id).toContain("verlof");
  });

  it("returns [] for an empty calendar", () => {
    expect(icsToDayEvents("BEGIN:VCALENDAR\nEND:VCALENDAR\n")).toEqual([]);
  });
});
