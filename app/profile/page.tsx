"use client";

import { ProfileDetail, useViewer } from "@/shared/components";

/** `/profile` — the synced user profile. */
export default function ProfilePage() {
  const { cache } = useViewer();
  if (!cache.profile) {
    return <div className="text-muted">Geen profiel — synchroniseer eerst.</div>;
  }
  return <ProfileDetail profile={cache.profile} />;
}
