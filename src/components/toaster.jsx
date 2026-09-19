import { useEffect, useState } from "react";
import { CheckCircle, Warning, Info, X } from "@/lib/icons";
import { subscribeToasts, dismissToast } from "@/lib/toast";

const KIND_STYLES = {
  success: "border border-emerald-500/30 bg-[var(--bg-card)] text-[var(--text-primary)] shadow-xl shadow-emerald-500/5",
  error: "border border-red-500/30 bg-[var(--bg-card)] text-[var(--text-primary)] shadow-xl shadow-red-500/5",
  info: "border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] shadow-xl",
};

const KIND_ICON_CONTAINERS = {
  success: "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20",
  error: "bg-red-500/10 text-red-500 border border-red-500/20",
  info: "bg-[var(--accent-mint)]/10 text-[var(--accent-mint)] border border-[var(--accent-mint)]/20",
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
      className="pointer-events-none fixed bottom-5 right-5 z-[200] flex w-[min(92vw,22rem)] flex-col gap-2.5"
      role="status"
      aria-live="polite"
    >
      {items.map((item) => {
        const Icon = KIND_ICONS[item.kind] || Info;
        return (
          <div
            key={item.id}
            className={`pointer-events-auto flex items-center gap-3.5 rounded-[14px] p-3.5 backdrop-blur-md transition-all duration-300 ${KIND_STYLES[item.kind] || KIND_STYLES.info}`}
          >
            <div className={`flex size-8 shrink-0 items-center justify-center rounded-full ${KIND_ICON_CONTAINERS[item.kind] || KIND_ICON_CONTAINERS.info}`}>
              <Icon className="size-4" weight="fill" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold leading-relaxed text-[var(--text-primary)]">{item.message}</p>
              {item.action ? (
                <button
                  type="button"
                  onClick={() => {
                    item.action.onClick();
                    dismissToast(item.id);
                  }}
                  className="mt-2 text-xs font-semibold text-[var(--accent-mint)] underline-offset-4 hover:underline"
                >
                  {item.action.label}
                </button>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(item.id)}
              className="rounded-full p-1 text-[var(--text-muted)] opacity-60 transition-all hover:bg-[var(--hover-overlay)] hover:opacity-100"
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
