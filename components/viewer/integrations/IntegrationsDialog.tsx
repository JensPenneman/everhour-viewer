"use client";

import { useState, type ReactNode } from "react";
import { Button, Dialog } from "@/components/ui";
import { PROVIDERS, type Provider } from "@/lib/providers";
import { HolidaysPanel } from "./HolidaysPanel";
import { IcsPanel } from "./IcsPanel";
import { ProviderRow } from "./ProviderRow";

export interface IntegrationsDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  /** Called after any provider state change so the outer hook can refetch. */
  readonly onProvidersChanged: () => void;
  readonly onToast: (message: string, kind: "good" | "error") => void;
}

/**
 * Integrations management dialog.
 *
 * Renders one {@link ProviderRow} per provider in the registry, with a
 * provider-specific settings component picked by id in
 * {@link providerPanel} below. Adding a new provider is two edits:
 * register it in `lib/providers/registry.ts` and add its case here.
 *
 * Provider status (`ready`, `message`, …) is read synchronously on each
 * render. A `tick` counter bumped by `notifyChange()` forces a re-render
 * after a child panel mutates underlying storage — no effect-driven
 * storage subscription is needed because all mutations originate inside
 * this dialog.
 */
export function IntegrationsDialog({
  open,
  onClose,
  onProvidersChanged,
  onToast,
}: IntegrationsDialogProps) {
  const [, setTick] = useState(0);

  function notifyChange() {
    setTick((t) => t + 1);
    onProvidersChanged();
  }

  return (
    <Dialog open={open} onClose={onClose} ariaLabel="Integraties beheren">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="m-0 text-[16px] font-semibold">Integraties</h3>
        <span className="text-[11px] text-muted">
          {PROVIDERS.length} {PROVIDERS.length === 1 ? "bron" : "bronnen"}
        </span>
      </div>
      <p className="m-0 mb-4 text-muted text-[13px] leading-relaxed">
        Bronnen leveren events die over je Everhour-weken worden gelegd. Alles wordt lokaal in deze
        browser opgeslagen — er gaat niets naar een server.
      </p>

      <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto">
        {PROVIDERS.map((p) => (
          <ProviderRow key={p.meta.id} provider={p} status={p.status()}>
            {providerPanel(p, notifyChange, onToast)}
          </ProviderRow>
        ))}
      </div>

      <div className="flex justify-end mt-5">
        <Button onClick={onClose}>Sluiten</Button>
      </div>
    </Dialog>
  );
}

function providerPanel(
  provider: Provider,
  notifyChange: () => void,
  onToast: (message: string, kind: "good" | "error") => void,
): ReactNode {
  switch (provider.meta.id) {
    case "holidays:be":
      return <HolidaysPanel />;
    case "ics:imported":
      return <IcsPanel onChange={notifyChange} onToast={onToast} />;
    default:
      return <div className="text-[12.5px] text-muted-soft">Geen instellingen.</div>;
  }
}
