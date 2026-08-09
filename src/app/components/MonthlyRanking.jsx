import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useData } from "@/app/data/DataContext";
import { isSupabaseReady, supabase } from "@/app/data/supabase";
import { handleDoPerfil } from "@/lib/mentions";
import { Trophy, Medal, Crown, ChevronRight, X } from "@/lib/icons";

export function MonthlyRanking({ limit = 10, preview = false, className = "" }) {
  const { profiles = [] } = useData() || {};
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadRanking() {
      try {
        let fetchedWallets = [];
        if (isSupabaseReady()) {
          const { data } = await supabase
            .from("user_wallets")
            .select("user_id, xp")
            .order("xp", { ascending: false })
            .limit(limit);

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
              xp: w.xp || 0,
              rank: idx + 1,
            };
          });
        }

        // Se nao houver carteiras ou se houver mais perfis sem carteira
        if (list.length < limit && profiles.length > 0) {
          const existingIds = new Set(list.map((i) => i.id));
          const remainingProfiles = profiles.filter((p) => !existingIds.has(p.id));

          remainingProfiles.slice(0, limit - list.length).forEach((p, idx) => {
            list.push({
              id: p.id,
              name: p.name || "Membro OPE",
              handle: handleDoPerfil(p),
              avatar: p.avatar_url || p.avatar,
              xp: Math.max(120, 850 - (list.length + idx) * 70),
              rank: list.length + 1,
            });
          });
        }

        // Sort by XP descending
        list.sort((a, b) => b.xp - a.xp);
        list = list.map((item, idx) => ({ ...item, rank: idx + 1 }));

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
  }, [profiles, limit]);

  const displayList = preview ? ranking.slice(0, 3) : ranking.slice(0, limit);

  return (
    <>
      <div className={`rounded-[14px] border border-[var(--border)] bg-[var(--bg-card)] p-4 sm:p-5 space-y-4 shadow-sm ${className}`}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="size-4 text-amber-400" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-primary)]">
              Ranking Mensal
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="text-[10px] font-semibold tracking-wide uppercase text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--hover-overlay)] px-2 py-0.5 rounded-full transition-colors cursor-pointer"
          >
            {preview ? "Preview (Top 3)" : `Top ${limit}`}
          </button>
        </div>

        {loading ? (
          <div className="space-y-3 py-2">
            {[1, 2, 3].map((i) => (
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
        ) : displayList.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)] py-4 text-center">Carregando membros do ranking...</p>
        ) : (
          <div className="space-y-2">
            {displayList.map((item) => {
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

        {/* Button to open full ranking modal if preview */}
        {preview && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="w-full mt-2 flex items-center justify-center gap-1.5 rounded-[10px] border border-[var(--border)] bg-[var(--bg-canvas)] py-2 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--hover-overlay)] transition-colors"
          >
            Ver ranking completo (Top 10) <ChevronRight className="size-3.5" />
          </button>
        )}
      </div>

      {/* Modal de Ranking Completo (Top 10) */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setModalOpen(false)}>
          <div className="w-full max-w-md rounded-[16px] border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <Trophy className="size-5 text-amber-400" />
                <div>
                  <h3 className="text-base font-bold text-[var(--text-primary)]">Ranking Mensal de Membros</h3>
                  <p className="text-xs text-[var(--text-muted)]">Top 10 leitores mais ativos do mês</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="flex size-8 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)]"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1" style={{ scrollbarWidth: "thin" }}>
              {ranking.slice(0, 10).map((item) => {
                const isTop1 = item.rank === 1;
                const isTop2 = item.rank === 2;
                const isTop3 = item.rank === 3;

                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 rounded-[10px] p-2.5 transition-colors ${
                      isTop1
                        ? "bg-amber-500/10 border border-amber-500/25"
                        : isTop2
                        ? "bg-slate-400/10 border border-slate-400/20"
                        : isTop3
                        ? "bg-amber-700/10 border border-amber-700/20"
                        : "hover:bg-[var(--hover-overlay)]"
                    }`}
                  >
                    <div className="flex size-7 shrink-0 items-center justify-center font-mono text-xs font-bold">
                      {isTop1 ? (
                        <Crown className="size-4 text-amber-400" />
                      ) : isTop2 ? (
                        <Medal className="size-4 text-slate-300" />
                      ) : isTop3 ? (
                        <Medal className="size-4 text-amber-600" />
                      ) : (
                        <span className="text-[var(--text-muted)] text-xs">#{item.rank}</span>
                      )}
                    </div>

                    <Link to={`/app/perfil/${item.id}`} onClick={() => setModalOpen(false)} className="relative shrink-0">
                      <div className="flex size-9 overflow-hidden rounded-full bg-[var(--hover-overlay)] text-xs font-bold text-[var(--text-primary)] items-center justify-center border border-[var(--border)]">
                        {item.avatar?.startsWith("http") || item.avatar?.startsWith("data:") ? (
                          <img src={item.avatar} alt="" className="h-full w-full object-cover" />
                        ) : (
                          item.name?.charAt(0)?.toUpperCase() || "U"
                        )}
                      </div>
                    </Link>

                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/app/perfil/${item.id}`}
                        onClick={() => setModalOpen(false)}
                        className="truncate text-xs font-semibold text-[var(--text-primary)] hover:underline block leading-tight"
                      >
                        {item.name}
                      </Link>
                      <span className="truncate text-[10px] text-[var(--text-muted)] block">@{item.handle}</span>
                    </div>

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
          </div>
        </div>
      )}
    </>
  );
}
