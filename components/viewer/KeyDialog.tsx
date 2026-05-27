"use client";

import { useState } from "react";
import { Button, Dialog } from "@/components/ui";
import { readApiKey } from "@/lib/storage";

export interface KeyDialogProps {
  readonly open: boolean;
  readonly hasEnvKey: boolean;
  readonly onClose: () => void;
  /** Called with the trimmed key (empty string ⇒ key removed). */
  readonly onSubmit: (value: string) => void;
}

export function KeyDialog({ open, hasEnvKey, onClose, onSubmit }: KeyDialogProps) {
  const [value, setValue] = useState<string>(() => readApiKey() ?? "");

  if (!open) return null;

  const save = () => onSubmit(value.trim());

  return (
    <Dialog open={open} onClose={onClose} ariaLabel="Everhour API-sleutel">
      <h3 className="m-0 mb-2 text-[15px] font-semibold">Everhour API-sleutel</h3>
      <p className="m-0 mb-4 text-muted text-[13px] leading-relaxed">
        {hasEnvKey
          ? "De server heeft een dev-sleutel. Vul hieronder een eigen sleutel in om die te overschrijven — wordt alleen in deze browser bewaard (localStorage)."
          : "Plak je persoonlijke API-sleutel. Wordt alleen in deze browser bewaard (localStorage) en bij elke sync naar de server gestuurd."}
      </p>
      <input
        type="password"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
        }}
        placeholder="xxxx-xxxx-xxxx-xxxx"
        autoComplete="off"
        autoFocus
        className="w-full px-3 py-2 border border-border rounded-md text-[13px] font-mono mb-4 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-bg"
      />
      <div className="flex justify-end gap-2">
        <Button onClick={onClose}>Annuleer</Button>
        <Button variant="primary" onClick={save}>
          Opslaan
        </Button>
      </div>
      <p className="m-0 mt-4 text-muted-soft text-[11.5px]">
        Je kan een sleutel maken op{" "}
        <a
          href="https://app.everhour.com/#/account/profile"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline"
        >
          Settings → Application Access
        </a>
        .
      </p>
    </Dialog>
  );
}
