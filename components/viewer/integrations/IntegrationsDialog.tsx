"use client";

import { useState } from "react";
import { Button, Dialog } from "@/components/ui";
import { PROVIDERS, type Provider, type ProviderStatus } from "@/lib/providers";
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
 * provider-specific settings component slotted in via the per-id map
 * below. Adding a new provider is two edits: register it in
 * `lib/providers/registry.ts` and add its panel below.
 */
export function IntegrationsDialog({
  open,
  onClose,
  onProvidersChanged,
  onToast,
}: IntegrationsDialogProps) {
  // `tick` is a render-key that child panels bump via `notifyChange()`
  // whenever they mutate a provider's underlying state. The next render
  // calls `provider.status()` afresh, so the badge and message stay
  // current — no effect-driven storage subscription needed because the
  // mutations all originate inside this dialog.
  const [tick, setTick] = useState(0);

  function notifyChange() {
    setTick((t) => t + 1);
    onProvidersChanged();
  }

  return (
    <Dialog open={open} onClose={onClose} ariaLabel="Integraties beheren">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="m-0 text-[16px] font-semibold">Integraties</h3>
        <span className="text-[11px] text-[var(--muted)]">
          {PROVIDERS.length} {PROVIDERS.length === 1 ? "bron" : "bronnen"}
        </span>
      </div>
      <p className="m-0 mb-4 text-[var(--muted)] text-[13px] leading-relaxed">
        Bronnen leveren events die over je Everhour-weken worden gelegd. Alles wordt lokaal in deze
        browser opgeslagen — er gaat niets naar een server.
      </p>

      <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto">
        {PROVIDERS.map((p) => (
          <ProviderRow key={p.meta.id} provider={p} status={statusFor(p, tick)}>
            {renderPanel(p, notifyChange, onToast)}
          </ProviderRow>
        ))}
      </div>

      <div className="flex justify-end mt-5">
        <Button onClick={onClose}>Sluiten</Button>
      </div>
    </Dialog>
  );
}

function statusFor(provider: Provider, _tick: number): ProviderStatus {
  // _tick is a dependency placeholder that forces this to re-read whenever
  // a child panel asks for a refresh.
  void _tick;
  return provider.status();
}

function renderPanel(
  provider: Provider,
  notifyChange: () => void,
  onToast: (message: string, kind: "good" | "error") => void,
): React.ReactNode {
  switch (provider.meta.id) {
    case "holidays:be":
      return <HolidaysPanel />;
    case "ics:imported":
      return <IcsPanel onChange={notifyChange} onToast={onToast} />;
    default:
      return <div className="text-[12.5px] text-[var(--muted-soft)]">Geen instellingen.</div>;
  }
}
