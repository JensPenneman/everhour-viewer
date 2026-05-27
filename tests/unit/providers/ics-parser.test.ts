import { describe, it, expect } from "vitest";
import { parseIcs } from "@/lib/providers/ics/parser";

const ALL_DAY_ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:abc@example.com
SUMMARY:Pinkstermaandag
DTSTART;VALUE=DATE:20260525
DTEND;VALUE=DATE:20260526
STATUS:CONFIRMED
END:VEVENT
BEGIN:VEVENT
UID:xyz@example.com
SUMMARY:Sprint planning
DTSTART:20260526T100000Z
DTEND:20260526T110000Z
END:VEVENT
END:VCALENDAR
`;

describe("parseIcs", () => {
  it("extracts all-day and timed events with the correct allDay flag", () => {
    const events = parseIcs(ALL_DAY_ICS);
    expect(events).toHaveLength(2);
    const [holiday, meeting] = events;
    expect(holiday?.allDay).toBe(true);
    expect(holiday?.start).toBe("2026-05-25");
    expect(holiday?.summary).toBe("Pinkstermaandag");
    expect(holiday?.status).toBe("CONFIRMED");
    expect(meeting?.allDay).toBe(false);
    expect(meeting?.start).toBe("2026-05-26T10:00:00Z");
  });

  it("unfolds CRLF-space continuation lines per RFC 5545 §3.1", () => {
    const folded = [
      "BEGIN:VEVENT",
      "SUMMARY:This is a very long",
      " summary continued",
      "DTSTART;VALUE=DATE:20260101",
      "END:VEVENT",
    ].join("\r\n");
    const events = parseIcs(folded);
    expect(events[0]?.summary).toBe("This is a very longsummary continued");
  });

  it("unescapes commas, semicolons, backslashes and \\n", () => {
    const escaped = [
      "BEGIN:VEVENT",
      "SUMMARY:Hello\\, world\\; goodbye\\\\backslash\\nnewline",
      "DTSTART;VALUE=DATE:20260101",
      "END:VEVENT",
    ].join("\n");
    const events = parseIcs(escaped);
    expect(events[0]?.summary).toBe("Hello, world; goodbye\\backslash\nnewline");
  });

  it("skips events missing SUMMARY or DTSTART", () => {
    const incomplete = [
      "BEGIN:VEVENT",
      "DTSTART;VALUE=DATE:20260101",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "SUMMARY:No date",
      "END:VEVENT",
    ].join("\n");
    expect(parseIcs(incomplete)).toHaveLength(0);
  });

  it("captures CATEGORIES as a list", () => {
    const withCats = [
      "BEGIN:VEVENT",
      "SUMMARY:Verlof",
      "CATEGORIES:Leave,Personal",
      "DTSTART;VALUE=DATE:20260601",
      "END:VEVENT",
    ].join("\n");
    expect(parseIcs(withCats)[0]?.categories).toEqual(["Leave", "Personal"]);
  });

  it("returns an empty array for non-ICS input", () => {
    expect(parseIcs("definitely not an ics file")).toEqual([]);
  });
});
