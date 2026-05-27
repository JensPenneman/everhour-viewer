"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui";
import { clearIcsImport, icsImportSummary, importIcsFile } from "@/lib/providers";

export interface IcsPanelProps {
  readonly onChange: () => void;
  readonly onToast: (message: string, kind: "good" | "error") => void;
}

/**
 * Settings panel for the `ics:imported` provider.
 *
 * Lets the user pick an `.ics` file and shows a summary of what was
 * imported. Calls `onChange` after a successful import or clear so the
 * outer hook can re-fetch.
 */
export function IcsPanel({ onChange, onToast }: IcsPanelProps) {
  const [summary, setSummary] = useState(() => icsImportSummary());
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(file: File) {
    setBusy(true);
    try {
      const text = await file.text();
      const result = importIcsFile(file.name, text);
      setSummary(icsImportSummary());
      onChange();
      onToast(
        result.count === 0
          ? `Geen hele-dag events gevonden in ${file.name}.`
          : `${result.count} events geïmporteerd uit ${file.name}.`,
        result.count === 0 ? "error" : "good",
      );
    } catch (e) {
      onToast(`Kon ${file.name} niet inlezen: ${(e as Error).message}`, "error");
    } finally {
      setBusy(false);
    }
  }

  function clear() {
    clearIcsImport();
    setSummary(null);
    onChange();
    onToast("ICS-import gewist", "good");
  }

  return (
    <div className="flex flex-col gap-2.5">
      {summary ? (
        <div className="text-[12.5px] text-muted">
          <span className="font-medium text-foreground">{summary.name}</span> · {summary.count}{" "}
          events · geïmporteerd {summary.importedAt.slice(0, 10)}
        </div>
      ) : (
        <div className="text-[12.5px] text-muted-soft">
          Geen kalender geladen. Exporteer een <code>.ics</code> uit Outlook of Google en upload
          hieronder.
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".ics,text/calendar"
        className="hidden"
        aria-label="Kies een .ics-bestand"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
          e.target.value = "";
        }}
      />

      <div className="flex gap-2">
        <Button onClick={() => inputRef.current?.click()} disabled={busy} size="sm">
          {summary ? "Vervang…" : "Kies .ics-bestand…"}
        </Button>
        {summary ? (
          <Button onClick={clear} disabled={busy} size="sm" variant="danger">
            Wissen
          </Button>
        ) : null}
      </div>
    </div>
  );
}
