"use client";

import type { Toast } from "@/hooks";

export interface ToastTrayProps {
  readonly toasts: ReadonlyArray<Toast>;
}

const BG_BY_KIND: Record<Toast["kind"], string> = {
  good: "bg-good",
  error: "bg-bad",
  info: "bg-foreground",
};

/** Bottom-right toast tray. Toasts stack newest-on-top with a fade-in. */
export function ToastTray({ toasts }: ToastTrayProps) {
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed bottom-5 right-5 flex flex-col gap-2 z-50"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.kind === "error" ? "alert" : "status"}
          className={`px-4 py-2.5 rounded-lg text-[13px] text-white shadow-lg max-w-sm animate-fade-in ${BG_BY_KIND[t.kind]}`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
