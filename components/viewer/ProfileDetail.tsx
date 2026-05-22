"use client";

import type { ReactNode } from "react";
import { SectionTitle } from "@/components/ui";
import type { EverhourProfile } from "@/lib/everhour";

export interface ProfileDetailProps {
  readonly profile: EverhourProfile;
}

export function ProfileDetail({ profile }: ProfileDetailProps) {
  const groups = Array.isArray(profile.groups) ? profile.groups.map((g) => g.name).join(", ") : "";
  const tz =
    profile.timezone !== null && profile.timezone !== undefined
      ? `UTC${profile.timezone >= 0 ? "+" : ""}${profile.timezone}`
      : "";
  const since = profile.createdAt ? profile.createdAt.slice(0, 10) : "";
  const avatar = profile.avatarUrlLarge || profile.avatarUrl;

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-5 mb-7">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatar}
            alt=""
            className="w-20 h-20 rounded-full bg-[var(--hover)] object-cover border border-[var(--border)]"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-[var(--accent-bg)] text-[var(--accent)] flex items-center justify-center font-semibold text-3xl border border-[var(--border)]">
            {profile.name?.charAt(0) ?? "?"}
          </div>
        )}
        <div>
          <h2 className="m-0 text-2xl font-semibold tracking-tight">{profile.name}</h2>
          <div className="text-[var(--muted)] text-[13px] mt-1">
            {profile.headline || profile.role}
            {profile.email ? ` · ${profile.email}` : ""}
          </div>
        </div>
      </div>

      <SectionTitle>Profiel</SectionTitle>
      <dl className="grid grid-cols-[180px_1fr] gap-y-2.5 gap-x-4 m-0 bg-[var(--panel)] border border-[var(--border)] rounded-xl p-5">
        <Field k="Rol" v={profile.role} />
        <Field k="Status" v={profile.status} />
        <Field k="Headline" v={profile.headline} />
        <Field k="Groepen" v={groups} />
        <Field k="Tijdzone" v={tz} />
        <Field k="Lid sinds" v={since} />
        <Field k="Capaciteit" v={`${profile.capacity ?? 0} u/week`} mono />
        <Field k="Kostprijs" v={String(profile.cost ?? 0)} mono />
        <Field k="User ID" v={String(profile.id)} mono />
        <Field k="Laatst gesynct" v={profile.exportedAt} mono />
      </dl>
    </div>
  );
}

function Field({
  k,
  v,
  mono,
}: {
  readonly k: string;
  readonly v: ReactNode;
  readonly mono?: boolean;
}) {
  return (
    <>
      <dt className="text-[var(--muted)] text-[13px]">{k}</dt>
      <dd className={`m-0 text-[13.5px] ${mono ? "font-mono text-[12.5px] tabular-nums" : ""}`}>
        {v || "—"}
      </dd>
    </>
  );
}
