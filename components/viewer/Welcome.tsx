"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui";

export interface WelcomeProps {
  readonly hasUserKey: boolean;
  readonly hasEnvKey: boolean;
  readonly onEnterKey: () => void;
  readonly onSync: () => void;
  readonly onLoad: () => void;
}

export function Welcome({ hasUserKey, hasEnvKey, onEnterKey, onSync, onLoad }: WelcomeProps) {
  const canSync = hasUserKey || hasEnvKey;
  const keyDescription =
    hasEnvKey && !hasUserKey
      ? "Een dev-sleutel is geconfigureerd. Je kunt direct synchroniseren."
      : "Je sleutel wordt alleen in deze browser bewaard en bij elke sync naar de server gestuurd.";

  return (
    <div className="flex flex-col items-center justify-center min-h-full px-6 py-12">
      <div className="max-w-md w-full">
        <h2 className="text-[22px] font-semibold mb-2 text-center">Welkom</h2>
        <p className="text-[var(--muted)] text-[14px] mb-7 text-center">
          Bekijk je Everhour tijdsregistraties lokaal. Je gegevens blijven in deze browser bewaard —
          niets wordt gedeeld.
        </p>

        <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl p-5 mb-3">
          <Step
            n={1}
            title="Voeg je API-sleutel toe"
            done={canSync}
            description={keyDescription}
            action={
              <Button variant={canSync ? "default" : "primary"} onClick={onEnterKey} size="sm">
                {hasUserKey ? "Sleutel wijzigen" : "Sleutel instellen"}
              </Button>
            }
          />
          <div className="border-t border-[var(--border)] my-3" />
          <Step
            n={2}
            title="Synchroniseer"
            description="Haalt profiel en de laatste 78 weken op. Volgende sync is incrementeel."
            action={
              <Button variant="primary" disabled={!canSync} onClick={onSync} size="sm">
                Synchroniseer
              </Button>
            }
          />
        </div>

        <div className="text-center text-[12px] text-[var(--muted)]">
          Heb je al een eerdere backup?{" "}
          <button type="button" onClick={onLoad} className="text-[var(--accent)] hover:underline">
            Laad een JSON-bestand
          </button>
        </div>
      </div>
    </div>
  );
}

interface StepProps {
  readonly n: number;
  readonly title: string;
  readonly description: ReactNode;
  readonly action: ReactNode;
  readonly done?: boolean;
}

function Step({ n, title, description, action, done }: StepProps) {
  return (
    <div className="flex gap-3.5 items-start">
      <div
        className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-semibold flex-shrink-0 ${
          done
            ? "bg-[var(--good-bg)] text-[var(--good)]"
            : "bg-[var(--accent-bg)] text-[var(--accent)]"
        }`}
      >
        {done ? "✓" : n}
      </div>
      <div className="flex-1">
        <div className="font-medium text-[14px] mb-0.5">{title}</div>
        <div className="text-[12.5px] text-[var(--muted)] mb-2.5 leading-relaxed">
          {description}
        </div>
        <div>{action}</div>
      </div>
    </div>
  );
}
