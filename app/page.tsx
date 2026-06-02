"use client";

import { TodayView } from "@/features/live";
import { useViewer, Welcome } from "@/shared/components";

/**
 * `/` — the live "Vandaag" view, or the onboarding screen on a first run
 * (no key/data). The shell only renders this once the persisted cache has
 * restored, so the welcome-vs-data choice never flashes.
 */
export default function HomePage() {
  const { apiKey, cache, runSync, openKeyDialog, openFilePicker } = useViewer();

  const hasData = cache.profile !== null || cache.weeks.length > 0;
  if (!hasData) {
    return (
      <Welcome
        hasUserKey={apiKey.hasUserKey}
        hasEnvKey={apiKey.hasEnvKey === true}
        onEnterKey={openKeyDialog}
        onSync={() => runSync(false)}
        onLoad={openFilePicker}
      />
    );
  }

  return (
    <TodayView
      canTrack={apiKey.canSync}
      profile={cache.profile}
      weeks={cache.weeks}
      onEnterKey={openKeyDialog}
      onSync={() => runSync(false)}
    />
  );
}
