import type { DayEventKind } from "@/lib/events";

interface ClassifierRule {
  readonly kind: DayEventKind;
  readonly pattern: RegExp;
}

/**
 * Heuristics for guessing the kind of a calendar entry from its summary.
 *
 * These are best-effort; users can re-tag in the UI later. The list is
 * ordered: the first match wins. Each pattern is case-insensitive.
 */
const RULES: ReadonlyArray<ClassifierRule> = [
  {
    kind: "leave",
    pattern: /\b(verlof|vacation|holiday off|pto|annual leave|out of office|ooo)\b/i,
  },
  { kind: "sick", pattern: /\b(ziek|sick|sick day|sick leave)\b/i },
  {
    kind: "holiday",
    pattern: /\b(feestdag|public holiday|bank holiday|christmas|kerstmis|new year|nieuwjaar)\b/i,
  },
  { kind: "office_closed", pattern: /\b(office closed|kantoor gesloten|company shutdown)\b/i },
];

export function classifySummary(summary: string): DayEventKind {
  for (const rule of RULES) {
    if (rule.pattern.test(summary)) return rule.kind;
  }
  return "other";
}
