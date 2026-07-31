import { useEffect, useState } from "react";
import { CheckCircle, Warning, Info, X } from "@/lib/icons";
import { subscribeToasts, dismissToast } from "@/lib/toast";

const KIND_STYLES = {
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  error: "border-red-500/30 bg-red-500/10 text-red-200",
  info: "border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)]",
};

const KIND_ICONS = {
  success: CheckCircle,
  error: Warning,
  info: Info,
};

export function Toaster() {
  const [items, setItems] = useState([]);

  useEffect(() => subscribeToasts(setItems), []);

  if (!items.length) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[200] flex w-[min(92vw,22rem)] flex-col gap-2"
      role="status"
      aria-live="polite"
    >
      {items.map((item) => {
        const Icon = KIND_ICONS[item.kind] || Info;
        return (
          <div
            key={item.id}
            className={`pointer-events-auto flex items-start gap-3 rounded-[10px] border px-3.5 py-3 shadow-[0_18px_45px_rgba(0,0,0,.32)] backdrop-blur ${KIND_STYLES[item.kind] || KIND_STYLES.info}`}
          >
            <Icon className="mt-0.5 size-4 shrink-0" weight="fill" />
            <p className="flex-1 text-sm leading-snug">{item.message}</p>
            <button
              type="button"
              onClick={() => dismissToast(item.id)}
              className="rounded-md p-1 opacity-70 transition-opacity hover:opacity-100"
              aria-label="Fechar"
            >
              <X className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
