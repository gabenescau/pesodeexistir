import { Trophy } from "lucide-react";
import { AchievementBadge } from "@/components/ui/achievement-badge";
import { computeAchievements } from "@/lib/achievements";

// Grade de conquistas. As desbloqueadas vem primeiro, brilhando; as travadas
// mostram a barra de quanto falta. Mesma grade no perfil proprio e no publico.
export function AchievementsPanel({ metrics, compact = false }) {
  const lista = computeAchievements(metrics);
  // Desbloqueadas primeiro; entre as travadas, as mais perto de completar vem antes.
  const ordenada = [...lista].sort(
    (a, b) => Number(b.unlocked) - Number(a.unlocked) || b.progress - a.progress
  );
  const visiveis = compact ? ordenada.filter((a) => a.unlocked).slice(0, 4) : ordenada;
  const desbloqueadas = lista.filter((a) => a.unlocked).length;

  if (compact && visiveis.length === 0) return null;

  return (
    <section className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-sm)] sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Trophy className="size-4 text-[var(--text-muted)]" />
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Conquistas</h3>
        </div>
        <span className="rounded-full border border-[var(--border)] px-2.5 py-0.5 text-xs text-[var(--text-muted)]">
          {desbloqueadas}/{lista.length}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
        {visiveis.map((a) => (
          <div key={a.id} className="flex flex-col gap-1.5">
            <AchievementBadge
              title={a.title}
              subtitle="Conquista"
              icon={a.icon}
              variant={a.variant}
              locked={!a.unlocked}
            />
            <p className="px-1 text-[11px] leading-snug text-[var(--text-muted)]">{a.desc}</p>
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
    </section>
  );
}
