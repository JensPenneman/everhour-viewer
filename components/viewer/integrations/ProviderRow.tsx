"use client";

import type { ReactNode } from "react";
import type { Provider, ProviderStatus } from "@/lib/providers";

export interface ProviderRowProps {
  readonly provider: Provider;
  readonly status: ProviderStatus;
  readonly children: ReactNode;
}

const CATEGORY_LABEL: Record<Provider["meta"]["category"], string> = {
  holidays: "Feestdagen",
  leave: "Verlof / HR",
  calendar: "Kalender",
  tasks: "Tickets",
  code: "Code",
};

/**
 * One row inside the Integrations dialog. Displays the provider's
 * metadata + status header and slots in the provider-specific settings
 * panel below.
 */
export function ProviderRow({ provider, status, children }: ProviderRowProps) {
  return (
    <div className="border border-border rounded-xl p-4 bg-panel">
      <div className="flex items-start gap-3 mb-2">
        <div
          className="w-9 h-9 rounded-lg bg-hover flex items-center justify-center text-[18px] shrink-0"
          aria-hidden="true"
        >
          {provider.meta.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[14px]">{provider.meta.name}</span>
            <span className="text-[10.5px] text-muted uppercase tracking-wider font-medium">
              {CATEGORY_LABEL[provider.meta.category]}
            </span>
          </div>
          <p className="m-0 text-[12.5px] text-muted leading-relaxed mt-0.5">
            {provider.meta.description}
          </p>
        </div>
        <div className="shrink-0">
          <span
            className={`inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full ${
              status.ready ? "bg-good-bg text-good" : "bg-hover text-muted"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${status.ready ? "bg-good" : "bg-muted-soft"}`}
              aria-hidden="true"
            />
            {status.ready ? "Actief" : "Niet actief"}
          </span>
        </div>
      </div>
      <div className="text-[12px] text-muted mb-2 pl-12">{status.message}</div>
      <div className="pl-12">{children}</div>
    </div>
  );
}
