import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Trophy, Coins, Crown, Medal, ArrowLeft } from "@/lib/icons";
import { rewardApi } from "@/lib/rewards";
import { isSupabaseReady, supabase } from "@/app/data/supabase";
import { useData } from "@/app/data/DataContext";
import { cn } from "@/lib/utils";

function Avatar({ name, avatar }) {
  if (avatar?.startsWith("http") || avatar?.startsWith("data:")) {
    return (
      <img
        src={avatar}
        alt=""
        loading="lazy"
        className="size-9 rounded-full object-cover border border-[var(--border)]"
      />
    );
  }
  return (
    <span className="flex size-9 items-center justify-center rounded-full bg-[var(--hover-overlay)] text-xs font-bold text-[var(--text-primary)] border border-[var(--border)]">
      {(name || "M").charAt(0).toUpperCase()}
    </span>
  );
}

export function RankingPage() {
  const { profiles = [] } = useData() || {};
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadRanking() {
      try {
        // Tentar via API rpc do Supabase
        const result = await rewardApi.creditsRanking(20);
        if (mounted && Array.isArray(result?.list) && result.list.length > 0) {
          setEntries(result.list);
          setLoading(false);
          return;
        }
      } catch {}

      // Fallback: consulta direta via Supabase
      try {
        if (isSupabaseReady()) {
          const { data: rows } = await supabase
            .from("user_wallets")
            .select("user_id, credits")
            .order("credits", { ascending: false })
            .limit(20);

          if (mounted && rows) {
            const ranked = rows.map((row, i) => {
              const profile = profiles.find((p) => p.id === row.user_id) || {};
              return {
                rank: i + 1,
                user_id: row.user_id,
                credits: row.credits || 0,
                name: profile.name || "Membro OPE",
                avatar: profile.avatar_url || profile.avatar || null,
              };
            });
            setEntries(ranked);
          }
        }
      } catch {}

      if (mounted) setLoading(false);
    }

    loadRanking();
    return () => {
      mounted = false;
    };
  }, [profiles]);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/app/inicio"
            className="flex size-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Ranking de Créditos</h1>
            <p className="text-xs text-[var(--text-muted)]">Membros com os maiores saldos de créditos OPE.</p>
          </div>
        </div>
        <Coins className="size-6 text-[#c58b42]" />
      </div>

      {/* Lista do Ranking */}
      <div className="rounded-[14px] border border-[var(--border)] bg-[var(--bg-card)] p-4 sm:p-6">
        {loading ? (
          <div className="space-y-3 py-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="size-6 rounded-full bg-[var(--hover-overlay)]" />
                <div className="size-9 rounded-full bg-[var(--hover-overlay)]" />
                <div className="h-4 flex-1 rounded bg-[var(--hover-overlay)]" />
                <div className="h-4 w-16 rounded bg-[var(--hover-overlay)]" />
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--text-muted)]">
            Nenhum saldo registrado ainda.
          </p>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {entries.map((entry) => {
              const isTop1 = entry.rank === 1;
              const isTop2 = entry.rank === 2;
              const isTop3 = entry.rank === 3;

              return (
                <Link
                  key={entry.user_id || entry.id}
                  to={`/app/perfil/${entry.user_id || entry.id}`}
                  className="flex items-center gap-3.5 py-3 transition-colors hover:bg-[var(--hover-overlay)] rounded-[8px] px-2"
                >
                  {/* Rank icon / number */}
                  <span className="flex w-6 shrink-0 items-center justify-center font-semibold text-sm">
                    {isTop1 ? (
                      <Crown className="size-5 text-amber-400" />
                    ) : isTop2 ? (
                      <Medal className="size-5 text-slate-300" />
                    ) : isTop3 ? (
                      <Medal className="size-5 text-amber-600" />
                    ) : (
                      <span className="text-xs text-[var(--text-muted)] font-mono">#{entry.rank}</span>
                    )}
                  </span>

                  <Avatar name={entry.name} avatar={entry.avatar} />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                      {entry.name}
                    </p>
                    {entry.handle && (
                      <p className="truncate text-xs text-[var(--text-muted)]">@{entry.handle}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-mono text-sm font-bold text-[#c58b42]">
                      {Number(entry.credits || 0).toLocaleString("pt-BR")}
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">cr.</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
