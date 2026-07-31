import { useState } from "react";
import { ChevronDown, Trophy } from "@/lib/icons";
import { AchievementBadge } from "@/components/ui/achievement-badge";
import { computeAchievements } from "@/lib/achievements";

// Grade de conquistas. As desbloqueadas vem primeiro, brilhando; as travadas
// mostram a barra de quanto falta. Mesma grade no perfil proprio e no publico.
export function AchievementsPanel({ metrics, compact = false }) {
  const [open, setOpen] = useState(!compact);
  const lista = computeAchievements(metrics);
  // Desbloqueadas primeiro; entre as travadas, as mais perto de completar vem antes.
  const ordenada = [...lista].sort(
    (a, b) => Number(b.unlocked) - Number(a.unlocked) || b.progress - a.progress
  );
  const visiveis = compact ? ordenada.filter((a) => a.unlocked).slice(0, 4) : ordenada;
  const desbloqueadas = lista.filter((a) => a.unlocked).length;

  if (compact && visiveis.length === 0) return null;

  return (
    <section className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-3 shadow-[var(--shadow-sm)] sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Trophy className="size-4 text-[var(--text-muted)]" />
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Conquistas</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-[var(--border)] px-2.5 py-0.5 text-xs text-[var(--text-muted)]">
            {desbloqueadas}/{lista.length}
          </span>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="inline-flex h-8 items-center gap-1 rounded-full border border-[var(--border)] px-3 text-xs text-[var(--text-primary)] transition-colors hover:bg-[var(--hover-overlay)]"
            aria-expanded={open}
          >
            {open ? "Fechar" : "Abrir"}
            <ChevronDown className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-4 grid grid-cols-1 gap-x-3 gap-y-3 min-[480px]:grid-cols-2 lg:grid-cols-3">
          {visiveis.map((a) => (
            <div key={a.id} className="flex min-w-0 flex-col gap-1.5 rounded-[10px] border border-[var(--border)] bg-[var(--bg-canvas)]/45 p-2">
              <AchievementBadge
                title={a.title}
                subtitle="Conquista"
                icon={a.icon}
                variant={a.variant}
                locked={!a.unlocked}
              />
              <p className="px-1 text-[10px] leading-snug text-[var(--text-muted)]">{a.desc}</p>
              {!a.unlocked && (
                <div className="px-1">
                  <div className="h-1 overflow-hidden rounded-full bg-[var(--border)]">
                    <div className="h-full rounded-full bg-[var(--text-primary)]" style={{ width: `${a.progress}%` }} />
                  </div>
                  <p className="mt-1 text-[10px] text-[var(--text-muted)]">
                    {a.value}/{a.goal}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
