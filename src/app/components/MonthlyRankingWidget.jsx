import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Trophy, Crown, Medal } from "@/lib/icons";
import { rewardApi } from "@/lib/rewards";
import { cn } from "@/lib/utils";

function Avatar({ name, avatar }) {
  if (avatar?.startsWith("http") || avatar?.startsWith("data:")) {
    return (
      <img
        src={avatar}
        alt=""
        loading="lazy"
        className="size-7 rounded-full object-cover border border-[var(--border)]"
      />
    );
  }
  return (
    <span className="flex size-7 items-center justify-center rounded-full bg-[var(--hover-overlay)] text-[10px] font-bold text-[var(--text-primary)] border border-[var(--border)]">
      {(name || "M").charAt(0).toUpperCase()}
    </span>
  );
}

export function MonthlyRankingWidget({ limit = 5 }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadRanking() {
      try {
        const result = await rewardApi.creditsRanking(limit);
        if (mounted) setEntries(Array.isArray(result?.list) ? result.list : []);
      } catch {
        if (mounted) setEntries([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadRanking();
    return () => {
      mounted = false;
    };
  }, [limit]);

  return (
    <section className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="size-4 text-[#c58b42]" />
          <h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">
            Ranking Mensal
          </h3>
        </div>
        <Link
          to="/app/ranking"
          className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          Ver tudo →
        </Link>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-2.5 animate-pulse">
              <div className="size-5 rounded-full bg-[var(--hover-overlay)]" />
              <div className="size-7 rounded-full bg-[var(--hover-overlay)]" />
              <div className="h-3 flex-1 rounded bg-[var(--hover-overlay)]" />
              <div className="h-3 w-12 rounded bg-[var(--hover-overlay)]" />
            </div>
          ))}
        </div>
      ) : entries.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)]">
          Ainda sem créditos registrados para comparar.
        </p>
      ) : (
        <div className="space-y-1">
          {entries.map((entry) => {
            const isTop1 = entry.rank === 1;
            const isTop2 = entry.rank === 2;
            const isTop3 = entry.rank === 3;
            const userId = entry.user_id || entry.id;

            return (
              <Link
                key={userId}
                to={`/app/perfil/${userId}`}
                className={cn(
                  "flex items-center gap-2.5 rounded-[8px] px-2 py-1.5 transition-colors hover:bg-[var(--hover-overlay)]",
                  entry.rank <= 3 && "bg-[var(--hover-overlay)]/40"
                )}
              >
                {/* Rank badge */}
                <span className="flex w-5 shrink-0 justify-center text-[10px] font-bold">
                  {isTop1 ? (
                    <Crown className="size-3.5 text-amber-400" />
                  ) : isTop2 ? (
                    <Medal className="size-3.5 text-slate-300" />
                  ) : isTop3 ? (
                    <Medal className="size-3.5 text-amber-600" />
                  ) : (
                    <span className="text-[var(--text-muted)] font-mono">#{entry.rank}</span>
                  )}
                </span>

                <Avatar name={entry.name} avatar={entry.avatar} />

                <span className="min-w-0 flex-1 truncate text-xs font-medium text-[var(--text-primary)]">
                  {entry.name}
                </span>

                <span className="shrink-0 font-mono text-[11px] font-semibold text-[#c58b42]">
                  {Number(entry.credits || 0).toLocaleString("pt-BR")}
                  <span className="ml-0.5 text-[9px] font-normal text-[var(--text-muted)]">cr</span>
                </span>
              </Link>
            );
          })}
        </div>
      )}

      <Link
        to="/app/ranking"
        className="flex w-full items-center justify-center gap-1 rounded-[8px] border border-[var(--border)] py-2 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)] transition-colors"
      >
        Ver ranking completo
      </Link>
    </section>
  );
}
