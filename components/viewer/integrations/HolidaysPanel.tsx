"use client";

/**
 * Settings panel for the `holidays:be` provider.
 *
 * Always-on, no credentials. Renders an informational note so the
 * Integrations dialog keeps a consistent layout across providers.
 */
export function HolidaysPanel() {
  return (
    <div className="text-[12.5px] text-muted-soft leading-relaxed">
      Officiële Belgische feestdagen worden automatisch toegevoegd zodra een week zichtbaar is. Geen
      configuratie nodig.
    </div>
  );
}
