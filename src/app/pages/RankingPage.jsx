import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { rewardApi } from "@/lib/rewards";
import { isSupabaseReady } from "@/app/data/supabase";
import { Trophy, Medal, Crown, Sparkles, Flame, UserCheck } from "@/lib/icons";

const MEDAL_COLORS = {
  1: "border-amber-400 text-amber-400",
  2: "border-slate-400 text-slate-300",
  3: "border-amber-700 text-amber-600",
};

function PodiumCard({ entry, position }) {
  const gold = position === 1;
  const silver = position === 2;
  const ringColor = gold
    ? "border-amber-500/40 bg-gradient-to-b from-amber-500/15 via-[var(--bg-card)] to-[var(--bg-card)]"
    : silver
    ? "border-slate-400/20 bg-gradient-to-b from-slate-400/10 to-[var(--bg-card)]"
    : "border-amber-700/20 bg-gradient-to-b from-amber-700/10 to-[var(--bg-card)]";

  const avatarSrc = entry.avatar?.startsWith("http") || entry.avatar?.startsWith("data:")
    ? entry.avatar
    : entry.avatar_url?.startsWith("http") || entry.avatar_url?.startsWith("data:")
    ? entry.avatar_url
    : null;

  const pillClass = gold
    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 text-sm"
    : silver
    ? "bg-slate-400/15 text-slate-100 border border-slate-400/20"
    : "bg-amber-700/10 text-amber-600";

  return (
    <div className={`relative overflow-hidden rounded-[16px] border ${ringColor} ${gold ? "p-6 shadow-lg sm:-translate-y-2" : "p-5"} text-center space-y-3 ${gold ? "rounded-[18px]" : ""}`}>
      <div className={`absolute top-3 right-3 font-mono text-xs font-bold ${MEDAL_COLORS[position]}`}>#{position}</div>

      {gold && <Crown className="size-6 text-amber-400 mx-auto -mb-1 animate-float" />}

      <div className={`inline-flex size-${gold ? 16 : 14} overflow-hidden rounded-full border-2 ${MEDAL_COLORS[position]} bg-[var(--hover-overlay)] mx-auto`}>
        {avatarSrc ? (
          <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className={`m-auto font-bold ${gold ? "text-xl text-amber-300" : "text-lg text-white"}`}>
            {entry.name?.charAt(0)}
          </span>
        )}
      </div>

      <div>
        <Link to={`/app/perfil/${entry.user_id}`} className={`font-bold ${gold ? "text-base" : "text-sm"} text-[var(--text-primary)] hover:underline block truncate`}>
          {entry.name}
          {entry.is_me && <span className="ml-1.5 text-[10px] font-normal uppercase tracking-wider text-[var(--text-muted)]">você</span>}
        </Link>
        <p className="text-[11px] text-[var(--text-muted)]">@{entry.handle}</p>
      </div>

      <div className={`inline-block rounded-full px-3 py-1 font-mono font-bold text-xs ${pillClass}`}>
        {Number(entry.xp).toLocaleString("pt-BR")} XP
      </div>
    </div>
  );
}

export function RankingPage() {
  const [ranking, setRanking] = useState([]);
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadRanking() {
      if (!isSupabaseReady()) {
        setLoading(false);
        return;
      }
      try {
        const result = await rewardApi.monthlyRanking(20);
        const list = Array.isArray(result?.list) ? result.list : [];
        if (active) {
          setRanking(list);
          setMe(result?.me || null);
          setLoading(false);
        }
      } catch (err) {
        if (active) {
          setError(err?.message || "Não foi possível carregar o ranking.");
          setLoading(false);
        }
      }
    }

    loadRanking();
    return () => { active = false; };
  }, []);

  const top3 = ranking.slice(0, 3);
  const rest = ranking.slice(3);

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
      ) : error ? (
        <div className="rounded-[14px] border border-[var(--border)] bg-[var(--bg-card)] p-10 text-center space-y-2">
          <Trophy className="size-8 text-[var(--text-muted)] mx-auto" />
          <p className="text-sm font-semibold text-[var(--text-primary)]">Ranking indisponível</p>
          <p className="text-xs text-[var(--text-muted)]">{error}</p>
        </div>
      ) : ranking.length === 0 ? (
        <div className="rounded-[14px] border border-[var(--border)] bg-[var(--bg-card)] p-10 text-center space-y-2">
          <Medal className="size-8 text-[var(--text-muted)] mx-auto" />
          <p className="text-sm font-semibold text-[var(--text-primary)]">Nenhum XP registrado este mês</p>
          <p className="text-xs text-[var(--text-muted)]">Complete missões e publique na comunidade para entrar no ranking!</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Top 3 Podio */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            {top3[1] && <div className="order-2 sm:order-1"><PodiumCard entry={top3[1]} position={2} /></div>}
            {top3[0] && <div className="order-1 sm:order-2"><PodiumCard entry={top3[0]} position={1} /></div>}
            {top3[2] && <div className="order-3"><PodiumCard entry={top3[2]} position={3} /></div>}
          </div>

          {/* Tabela de Posições */}
          <div className="rounded-[16px] border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden shadow-sm">
            <div className="border-b border-[var(--border)] px-5 py-3.5 bg-[var(--hover-overlay)]/30 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Membros Ranqueados</span>
              <span className="text-xs text-[var(--text-muted)]">Top 20 do mês</span>
            </div>

            <div className="divide-y divide-[var(--border)]">
              {rest.map((item) => (
                <div key={item.user_id} className={`flex items-center gap-4 px-5 py-3.5 transition-colors ${item.is_me ? "bg-[var(--hover-overlay)]" : "hover:bg-[var(--hover-overlay)]"}`}>
                  <span className={`font-mono text-sm font-bold w-6 text-center ${item.is_me ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}>#{item.rank}</span>

                  <Link to={`/app/perfil/${item.user_id}`} className="relative shrink-0">
                    <div className="flex size-10 overflow-hidden rounded-full bg-[var(--hover-overlay)] text-sm font-bold text-[var(--text-primary)] items-center justify-center border border-[var(--border)]">
                      {item.avatar?.startsWith("http") || item.avatar?.startsWith("data:") || item.avatar_url?.startsWith("http") ? (
                        <img src={item.avatar || item.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        item.name?.charAt(0)?.toUpperCase() || "U"
                      )}
                    </div>
                  </Link>

                  <div className="min-w-0 flex-1">
                    <Link to={`/app/perfil/${item.user_id}`} className="truncate text-sm font-semibold text-[var(--text-primary)] hover:underline block">
                      {item.name}
                      {item.is_me && <span className="ml-1.5 text-[10px] font-normal uppercase tracking-wider text-[var(--text-muted)]">você</span>}
                    </Link>
                    <span className="truncate text-xs text-[var(--text-muted)] block">@{item.handle} · Nível {item.level ?? 1}</span>
                  </div>

                  <div className="text-right">
                    <span className="text-sm font-bold font-mono text-[var(--text-primary)]">
                      {Number(item.xp).toLocaleString("pt-BR")} <span className="text-xs font-sans text-[var(--text-muted)]">XP</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Minha posição fora do top 20 */}
          {me && !me.is_me && !ranking.some((r) => r.is_me) && (
            <div className="rounded-[16px] border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden shadow-sm">
              <div className="border-b border-[var(--border)] px-5 py-3.5 bg-[var(--hover-overlay)]/30">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Sua Posição</span>
              </div>
              <div className="flex items-center gap-4 px-5 py-3.5 bg-[var(--hover-overlay)]">
                <span className="font-mono text-sm font-bold text-[var(--text-primary)] w-6 text-center">#{me.rank}</span>
                <div className="flex size-10 items-center justify-center rounded-full bg-[var(--bg-card)] border border-[var(--border)]">
                  <UserCheck className="size-5 text-[var(--text-primary)]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--text-primary)]">Você</p>
                  <span className="truncate text-xs text-[var(--text-muted)] block">Nível {me.level ?? 1}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold font-mono text-[var(--text-primary)]">
                    {Number(me.xp).toLocaleString("pt-BR")} <span className="text-xs font-sans text-[var(--text-muted)]">XP</span>
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Rodapé informativo */}
          <div className="flex items-center gap-3 rounded-[14px] border border-[var(--border)] bg-[var(--bg-card)] px-5 py-4">
            <Flame className="size-5 text-amber-400 shrink-0" />
            <p className="text-xs text-[var(--text-muted)]">
              O ranking zera todo dia 1º. Continue lendo, completando missões e publicando para subir de posição!
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
