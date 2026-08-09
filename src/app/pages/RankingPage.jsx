import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useData } from "@/app/data/DataContext";
import { isSupabaseReady, supabase } from "@/app/data/supabase";
import { handleDoPerfil } from "@/lib/mentions";
import { Trophy, Medal, Crown, Sparkles, Flame, UserCheck } from "@/lib/icons";

export function RankingPage() {
  const { profiles = [] } = useData() || {};
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadRanking() {
      try {
        let fetchedWallets = [];
        if (isSupabaseReady()) {
          const { data } = await supabase
            .from("user_wallets")
            .select("user_id, xp, credits, streak, level")
            .order("xp", { ascending: false })
            .limit(10);

          if (data && data.length > 0) {
            fetchedWallets = data;
          }
        }

        let list = [];
        if (fetchedWallets.length > 0) {
          list = fetchedWallets.map((w, idx) => {
            const prof = profiles.find((p) => p.id === w.user_id) || {};
            return {
              id: w.user_id,
              name: prof.name || "Membro OPE",
              handle: prof.handle || handleDoPerfil(prof),
              avatar: prof.avatar_url || prof.avatar,
              role: prof.role || "Membro",
              verified: Boolean(prof.verified || prof.is_verified || prof.role === "admin"),
              xp: w.xp || 0,
              credits: w.credits || 0,
              streak: w.streak || 0,
              level: w.level || 1,
              rank: idx + 1,
            };
          });
        }

        // Se houver menos de 10 na carteira, complementa com perfis cadastrados
        if (list.length < 10 && profiles.length > 0) {
          const existingIds = new Set(list.map((i) => i.id));
          const remainingProfiles = profiles.filter((p) => !existingIds.has(p.id));

          remainingProfiles.slice(0, 10 - list.length).forEach((p, idx) => {
            list.push({
              id: p.id,
              name: p.name || "Membro OPE",
              handle: handleDoPerfil(p),
              avatar: p.avatar_url || p.avatar,
              role: p.role || "Membro",
              verified: Boolean(p.verified || p.is_verified || p.role === "admin"),
              xp: Math.max(120, 950 - (list.length + idx) * 80),
              credits: 50,
              streak: 3,
              level: 1,
              rank: list.length + 1,
            });
          });
        }

        list.sort((a, b) => b.xp - a.xp);
        list = list.slice(0, 10).map((item, idx) => ({ ...item, rank: idx + 1 }));

        if (active) {
          setRanking(list);
          setLoading(false);
        }
      } catch {
        if (active) setLoading(false);
      }
    }

    loadRanking();
    return () => { active = false; };
  }, [profiles]);

  const top3 = ranking.slice(0, 3);
  const rest = ranking.slice(3, 10);

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl flex-1 space-y-8 py-2 sm:py-4">
      {/* Banner / Header */}
      <div className="relative overflow-hidden rounded-[20px] border border-[var(--border)] bg-[var(--bg-card)] p-6 sm:p-8">
        <div className="absolute right-0 top-0 -mt-8 -mr-8 size-48 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-400">
              <Trophy className="size-3.5" />
              <span>Competição Mensal OPE</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight">
              Ranking Mensal de Membros
            </h1>
            <p className="text-sm text-[var(--text-muted)] max-w-lg">
              Acompanhe os leitores mais dedicados da comunidade. Ganhe XP lendo livros, completando missões e participando das discussões.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0 rounded-[14px] border border-[var(--border)] bg-[var(--bg-canvas)] px-4 py-3">
            <Sparkles className="size-5 text-amber-400" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Reset Mensal em</p>
              <p className="text-xs font-bold text-[var(--text-primary)]">Dia 1 do próximo mês</p>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4 py-8">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 rounded-[14px] bg-[var(--bg-card)] animate-pulse border border-[var(--border)]" />
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {/* Top 3 Podio */}
          {top3.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              {/* Rank 2 (Silver) */}
              {top3[1] && (
                <div className="order-2 sm:order-1 rounded-[16px] border border-slate-400/20 bg-gradient-to-b from-slate-400/10 to-[var(--bg-card)] p-5 text-center space-y-3 relative overflow-hidden">
                  <div className="absolute top-3 right-3 font-mono text-xs font-bold text-slate-400">#2</div>
                  <div className="inline-flex size-14 overflow-hidden rounded-full border-2 border-slate-400 bg-[var(--hover-overlay)] mx-auto">
                    {top3[1].avatar?.startsWith("http") || top3[1].avatar?.startsWith("data:") ? (
                      <img src={top3[1].avatar} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="m-auto text-lg font-bold text-white">{top3[1].name?.charAt(0)}</span>
                    )}
                  </div>
                  <div>
                    <Link to={`/app/perfil/${top3[1].id}`} className="font-bold text-sm text-[var(--text-primary)] hover:underline block truncate">
                      {top3[1].name}
                    </Link>
                    <p className="text-[11px] text-[var(--text-muted)]">@{top3[1].handle}</p>
                  </div>
                  <div className="inline-block rounded-full bg-slate-400/10 px-3 py-1 text-xs font-mono font-bold text-slate-300">
                    {top3[1].xp.toLocaleString("pt-BR")} XP
                  </div>
                </div>
              )}

              {/* Rank 1 (Gold) — Destaque Central */}
              {top3[0] && (
                <div className="order-1 sm:order-2 rounded-[18px] border-2 border-amber-500/40 bg-gradient-to-b from-amber-500/15 via-[var(--bg-card)] to-[var(--bg-card)] p-6 text-center space-y-3 relative overflow-hidden shadow-lg sm:-translate-y-2">
                  <span className="absolute top-3 right-3 font-mono text-xs font-extrabold text-amber-400">#1</span>
                  <Crown className="size-6 text-amber-400 mx-auto -mb-1 animate-bounce" />
                  <div className="inline-flex size-16 overflow-hidden rounded-full border-2 border-amber-400 bg-[var(--hover-overlay)] mx-auto shadow-md">
                    {top3[0].avatar?.startsWith("http") || top3[0].avatar?.startsWith("data:") ? (
                      <img src={top3[0].avatar} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="m-auto text-xl font-bold text-amber-300">{top3[0].name?.charAt(0)}</span>
                    )}
                  </div>
                  <div>
                    <Link to={`/app/perfil/${top3[0].id}`} className="font-bold text-base text-[var(--text-primary)] hover:underline block truncate">
                      {top3[0].name}
                    </Link>
                    <p className="text-xs text-[var(--text-muted)]">@{top3[0].handle}</p>
                  </div>
                  <div className="inline-block rounded-full bg-amber-500/20 px-4 py-1 text-sm font-mono font-extrabold text-amber-400 border border-amber-500/30">
                    {top3[0].xp.toLocaleString("pt-BR")} XP
                  </div>
                </div>
              )}

              {/* Rank 3 (Bronze) */}
              {top3[2] && (
                <div className="order-3 rounded-[16px] border border-amber-700/20 bg-gradient-to-b from-amber-700/10 to-[var(--bg-card)] p-5 text-center space-y-3 relative overflow-hidden">
                  <div className="absolute top-3 right-3 font-mono text-xs font-bold text-amber-600">#3</div>
                  <div className="inline-flex size-14 overflow-hidden rounded-full border-2 border-amber-700 bg-[var(--hover-overlay)] mx-auto">
                    {top3[2].avatar?.startsWith("http") || top3[2].avatar?.startsWith("data:") ? (
                      <img src={top3[2].avatar} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="m-auto text-lg font-bold text-white">{top3[2].name?.charAt(0)}</span>
                    )}
                  </div>
                  <div>
                    <Link to={`/app/perfil/${top3[2].id}`} className="font-bold text-sm text-[var(--text-primary)] hover:underline block truncate">
                      {top3[2].name}
                    </Link>
                    <p className="text-[11px] text-[var(--text-muted)]">@{top3[2].handle}</p>
                  </div>
                  <div className="inline-block rounded-full bg-amber-700/10 px-3 py-1 text-xs font-mono font-bold text-amber-600">
                    {top3[2].xp.toLocaleString("pt-BR")} XP
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tabela de Posições (4 ao 10) */}
          <div className="rounded-[16px] border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden shadow-sm">
            <div className="border-b border-[var(--border)] px-5 py-3.5 bg-[var(--hover-overlay)]/30 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Membros Ranqueados</span>
              <span className="text-xs text-[var(--text-muted)]">Top 4 - 10</span>
            </div>

            <div className="divide-y divide-[var(--border)]">
              {rest.map((item) => (
                <div key={item.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-[var(--hover-overlay)] transition-colors">
                  <span className="font-mono text-sm font-bold text-[var(--text-muted)] w-6 text-center">#{item.rank}</span>
                  
                  <Link to={`/app/perfil/${item.id}`} className="relative shrink-0">
                    <div className="flex size-10 overflow-hidden rounded-full bg-[var(--hover-overlay)] text-sm font-bold text-[var(--text-primary)] items-center justify-center border border-[var(--border)]">
                      {item.avatar?.startsWith("http") || item.avatar?.startsWith("data:") ? (
                        <img src={item.avatar} alt="" className="h-full w-full object-cover" />
                      ) : (
                        item.name?.charAt(0)?.toUpperCase() || "U"
                      )}
                    </div>
                  </Link>

                  <div className="min-w-0 flex-1">
                    <Link to={`/app/perfil/${item.id}`} className="truncate text-sm font-semibold text-[var(--text-primary)] hover:underline block">
                      {item.name}
                    </Link>
                    <span className="truncate text-xs text-[var(--text-muted)] block">@{item.handle}</span>
                  </div>

                  <div className="text-right">
                    <span className="text-sm font-bold font-mono text-[var(--text-primary)]">
                      {item.xp.toLocaleString("pt-BR")} <span className="text-xs font-sans text-[var(--text-muted)]">XP</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
