"use client";

import type { RefObject } from "react";
import type { EverhourProfile } from "@/lib/everhour";
import { Button, Menu, MenuDivider, MenuItem } from "@/components/ui";
import type { SyncProgress } from "@/hooks";
import { Logo } from "./Logo";
import { ProgressBar } from "./ProgressBar";

export interface HeaderProps {
  readonly profile: EverhourProfile | null;
  readonly weekCount: number;
  readonly totalHours: number;
  readonly progress: SyncProgress | null;
  readonly canSync: boolean;
  readonly syncing: boolean;
  readonly hasUserKey: boolean;
  readonly hasData: boolean;
  readonly fileInputRef: RefObject<HTMLInputElement | null>;
  readonly menuOpen: boolean;
  readonly onSync: () => void;
  readonly onForceSync: () => void;
  readonly onDownloadBackup: () => void;
  readonly onOpenKeyDialog: () => void;
  readonly onOpenIntegrations: () => void;
  readonly onClearCache: () => void;
  readonly onMenuToggle: () => void;
  readonly onMenuClose: () => void;
  readonly onLoadFiles: (files: FileList) => void;
}

export function Header(props: HeaderProps) {
  const {
    profile,
    weekCount,
    totalHours,
    progress,
    canSync,
    syncing,
    hasUserKey,
    hasData,
    fileInputRef,
    menuOpen,
    onSync,
    onForceSync,
    onDownloadBackup,
    onOpenKeyDialog,
    onOpenIntegrations,
    onClearCache,
    onMenuToggle,
    onMenuClose,
    onLoadFiles,
  } = props;

  return (
    <header className="px-5 h-14 bg-panel border-b border-border flex items-center gap-3 shrink-0">
      <div className="flex items-center gap-2.5">
        <Logo />
        <span className="font-semibold text-[15px] tracking-tight">Everhour viewer</span>
      </div>

      <div className="flex-1 min-w-0 px-4">
        {progress ? (
          <ProgressBar progress={progress} />
        ) : (
          <span className="text-muted text-[13px] truncate">
            {summary(profile, weekCount, totalHours)}
          </span>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".json"
        aria-label="Laad een eerder gedownloade backup"
        className="hidden"
        onChange={(e) => e.target.files && onLoadFiles(e.target.files)}
      />

      <Button
        variant="primary"
        disabled={syncing || !canSync}
        onClick={onSync}
        title={!canSync ? "Stel eerst een API-sleutel in" : "Haal nieuwe en gewijzigde weken op"}
      >
        {syncing ? "Bezig…" : "Synchroniseer"}
      </Button>

      <Menu
        open={menuOpen}
        onClose={onMenuClose}
        anchor={
          <Button onClick={onMenuToggle} aria-label="Menu" aria-expanded={menuOpen}>
            <DotsIcon />
          </Button>
        }
      >
        <MenuItem onClick={onForceSync} disabled={!canSync || syncing}>
          Forceer volledige sync
        </MenuItem>
        <MenuItem onClick={onDownloadBackup} disabled={!hasData}>
          Backup downloaden
        </MenuItem>
        <MenuItem onClick={() => fileInputRef.current?.click()}>Backup laden…</MenuItem>
        <MenuDivider />
        <MenuItem onClick={onOpenIntegrations}>Integraties beheren…</MenuItem>
        <MenuItem onClick={onOpenKeyDialog}>
          API-sleutel{hasUserKey ? " wijzigen" : " instellen"}
        </MenuItem>
        <MenuItem onClick={onClearCache} danger disabled={!hasData}>
          Cache wissen
        </MenuItem>
      </Menu>
    </header>
  );
}

function summary(profile: EverhourProfile | null, weekCount: number, totalHours: number): string {
  if (profile) {
    return `${profile.name} · ${weekCount} ${weekCount === 1 ? "week" : "weken"} · ${totalHours.toFixed(1)}u totaal`;
  }
  if (weekCount) {
    return `${weekCount} weken · ${totalHours.toFixed(1)}u totaal`;
  }
  return "Geen gegevens geladen";
}

function DotsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <circle cx="3" cy="8" r="1.2" />
      <circle cx="8" cy="8" r="1.2" />
      <circle cx="13" cy="8" r="1.2" />
    </svg>
  );
}
