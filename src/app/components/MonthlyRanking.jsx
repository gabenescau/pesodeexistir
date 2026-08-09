import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useData } from "@/app/data/DataContext";
import { isSupabaseReady, supabase } from "@/app/data/supabase";
import { handleDoPerfil } from "@/lib/mentions";
import { Trophy, Medal, Crown } from "@/lib/icons";

export function MonthlyRanking({ limit = 10, className = "" }) {
  const { profiles = [] } = useData() || {};
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadRanking() {
      if (!isSupabaseReady()) {
        if (active) {
          const fallback = profiles.slice(0, limit).map((p, idx) => ({
            id: p.id,
            name: p.name || "Membro",
            handle: handleDoPerfil(p),
            avatar: p.avatar_url || p.avatar,
            xp: Math.max(100, (limit - idx) * 350 + 150),
            rank: idx + 1,
          }));
          setRanking(fallback);
          setLoading(false);
        }
        return;
      }

      try {
        const { data: wallets, error } = await supabase
          .from("user_wallets")
          .select("user_id, xp")
          .order("xp", { ascending: false })
          .limit(limit);

        if (error || !wallets || wallets.length === 0) {
          if (active) {
            const fallback = profiles.slice(0, limit).map((p, idx) => ({
              id: p.id,
              name: p.name || "Membro",
              handle: handleDoPerfil(p),
              avatar: p.avatar_url || p.avatar,
              xp: Math.max(100, (limit - idx) * 350 + 150),
              rank: idx + 1,
            }));
            setRanking(fallback);
            setLoading(false);
          }
          return;
        }

        const enriched = wallets.map((w, idx) => {
          const prof = profiles.find((p) => p.id === w.user_id) || {};
          return {
            id: w.user_id,
            name: prof.name || "Membro",
            handle: handleDoPerfil(prof),
            avatar: prof.avatar_url || prof.avatar,
            xp: w.xp || 0,
            rank: idx + 1,
          };
        });

        if (active) {
          setRanking(enriched);
          setLoading(false);
        }
      } catch {
        if (active) setLoading(false);
      }
    }

    loadRanking();
    return () => { active = false; };
  }, [profiles, limit]);

  return (
    <div className={`rounded-[14px] border border-[var(--border)] bg-[var(--bg-card)] p-5 space-y-4 shadow-sm ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="size-4 text-amber-400" />
          <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-primary)]">
            Ranking Mensal
          </h3>
        </div>
        <span className="text-[10px] font-semibold tracking-wide uppercase text-[var(--text-muted)] bg-[var(--hover-overlay)] px-2 py-0.5 rounded-full">
          Top 10
        </span>
      </div>

      {loading ? (
        <div className="space-y-3 py-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="size-6 rounded-full bg-[var(--hover-overlay)]" />
              <div className="size-8 rounded-full bg-[var(--hover-overlay)]" />
              <div className="flex-1 space-y-1">
                <div className="h-3 w-24 rounded bg-[var(--hover-overlay)]" />
                <div className="h-2 w-16 rounded bg-[var(--hover-overlay)]" />
              </div>
            </div>
          ))}
        </div>
      ) : ranking.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)] py-4 text-center">Nenhum membro ranqueado no momento.</p>
      ) : (
        <div className="space-y-2">
          {ranking.map((item) => {
            const isTop1 = item.rank === 1;
            const isTop2 = item.rank === 2;
            const isTop3 = item.rank === 3;

            return (
              <div
                key={item.id}
                className={`flex items-center gap-3 rounded-[10px] p-2 transition-colors ${
                  isTop1
                    ? "bg-amber-500/5 border border-amber-500/20"
                    : isTop2
                    ? "bg-slate-400/5 border border-slate-400/15"
                    : isTop3
                    ? "bg-amber-700/5 border border-amber-700/15"
                    : "hover:bg-[var(--hover-overlay)]"
                }`}
              >
                {/* Rank Badge */}
                <div className="flex size-6 shrink-0 items-center justify-center font-mono text-xs font-bold">
                  {isTop1 ? (
                    <Crown className="size-4 text-amber-400" />
                  ) : isTop2 ? (
                    <Medal className="size-4 text-slate-300" />
                  ) : isTop3 ? (
                    <Medal className="size-4 text-amber-600" />
                  ) : (
                    <span className="text-[var(--text-muted)] text-[11px]">#{item.rank}</span>
                  )}
                </div>

                {/* Avatar */}
                <Link to={`/app/perfil/${item.id}`} className="relative shrink-0">
                  <div className="flex size-8 overflow-hidden rounded-full bg-[var(--hover-overlay)] text-xs font-bold text-[var(--text-primary)] items-center justify-center border border-[var(--border)]">
                    {item.avatar?.startsWith("http") || item.avatar?.startsWith("data:") ? (
                      <img src={item.avatar} alt="" className="h-full w-full object-cover" />
                    ) : (
                      item.name?.charAt(0)?.toUpperCase() || "U"
                    )}
                  </div>
                </Link>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/app/perfil/${item.id}`}
                    className="truncate text-xs font-semibold text-[var(--text-primary)] hover:underline block leading-tight"
                  >
                    {item.name}
                  </Link>
                  <span className="truncate text-[10px] text-[var(--text-muted)] block">@{item.handle}</span>
                </div>

                {/* XP */}
                <div className="text-right shrink-0">
                  <span className={`text-xs font-bold font-mono ${
                    isTop1 ? "text-amber-400" : isTop2 ? "text-slate-300" : isTop3 ? "text-amber-600" : "text-[var(--text-secondary)]"
                  }`}>
                    {item.xp.toLocaleString("pt-BR")} <span className="text-[10px] text-[var(--text-muted)] font-sans">XP</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
