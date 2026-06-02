"use client";

import { useCallback, useRef, useState } from "react";

export type ToastKind = "good" | "error" | "info";

export interface Toast {
  readonly id: number;
  readonly message: string;
  readonly kind: ToastKind;
}

export interface ToastsApi {
  readonly toasts: ReadonlyArray<Toast>;
  readonly push: (message: string, kind?: ToastKind) => void;
  readonly dismiss: (id: number) => void;
}

const DEFAULT_TIMEOUTS: Record<ToastKind, number> = {
  good: 2500,
  info: 2500,
  error: 5500,
};

/**
 * Minimal toast queue.
 *
 * Toasts auto-dismiss after a kind-dependent timeout (errors stay longer
 * to give the user time to read). Timeouts are cleared on unmount so the
 * hook doesn't leak setState calls into a dead tree.
 */
export function useToasts(): ToastsApi {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t) {
      clearTimeout(t);
      timers.current.delete(id);
    }
    setToasts((cur) => cur.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (message: string, kind: ToastKind = "info") => {
      const id = Date.now() + Math.random();
      setToasts((cur) => [...cur, { id, message, kind }]);
      const timer = setTimeout(() => dismiss(id), DEFAULT_TIMEOUTS[kind]);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  return { toasts, push, dismiss };
}
