"use client";

import { useCallback, useRef } from "react";
import type { ToastKind } from "@/shared/hooks";

export interface AlertApi {
  /** Break/apply alert: a short beep + (if granted) a Notification + always a toast. */
  readonly notify: (title: string, body: string) => void;
  /** Ask for Notification permission — must be called from a user gesture. */
  readonly ensurePermission: () => void;
  /** Unlock audio on a user gesture so later beeps aren't blocked by autoplay policy. */
  readonly prime: () => void;
}

type AudioCtor = typeof AudioContext;

/**
 * Break / apply alerts. There is no existing audio or notification precedent in
 * the app, so this is intentionally tiny and defensive: a Web Audio beep (no
 * bundled asset), a best-effort `Notification`, and a guaranteed toast fallback.
 * Everything degrades silently when a capability is missing or blocked.
 */
export function useAlert(pushToast: (message: string, kind?: ToastKind) => void): AlertApi {
  const ctxRef = useRef<AudioContext | null>(null);

  const getCtx = useCallback((): AudioContext | null => {
    if (typeof window === "undefined") return null;
    if (ctxRef.current) return ctxRef.current;
    const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
    const Ctor = w.AudioContext ?? w.webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctxRef.current = new Ctor();
    } catch {
      return null;
    }
    return ctxRef.current;
  }, []);

  const prime = useCallback(() => {
    const ctx = getCtx();
    if (ctx && ctx.state === "suspended") void ctx.resume();
  }, [getCtx]);

  const beep = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    try {
      if (ctx.state === "suspended") void ctx.resume();
      const t0 = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, t0);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.2, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.42);
    } catch {
      /* ignore — audio is best-effort */
    }
  }, [getCtx]);

  const ensurePermission = useCallback(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      void Notification.requestPermission().catch(() => undefined);
    }
  }, []);

  const notify = useCallback(
    (title: string, body: string) => {
      beep();
      if (
        typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        try {
          new Notification(title, { body });
        } catch {
          /* ignore — Notification unsupported in some PWAs */
        }
      }
      pushToast(body, "good");
    },
    [beep, pushToast],
  );

  return { notify, ensurePermission, prime };
}
