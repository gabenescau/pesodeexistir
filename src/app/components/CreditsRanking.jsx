import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Coins, Crown, Medal, Trophy } from "@/lib/icons";
import { rewardApi } from "@/lib/rewards";

function Avatar({ entry }) {
  return entry.avatar ? (
    <img src={entry.avatar} alt="" loading="lazy" className="size-8 rounded-full object-cover" />
  ) : (
    <span className="flex size-8 items-center justify-center rounded-full bg-[var(--hover-overlay)] text-xs font-semibold text-[var(--text-primary)]">
      {(entry.name || "M").slice(0, 1).toUpperCase()}
    </span>
  );
}

export function CreditsRanking({ limit = 5 }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    rewardApi.creditsRanking(limit)
      .then((result) => {
        if (mounted) setEntries(Array.isArray(result?.list) ? result.list : []);
      })
      .catch(() => {
        if (mounted) setEntries([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [limit]);

  return (
    <section className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">
          <Trophy className="size-4 text-[#c58b42]" /> Maiores saldos
        </h3>
        <Coins className="size-4 text-[#c58b42]" />
      </div>
      {loading ? (
        <p className="text-xs text-[var(--text-muted)]">Carregando...</p>
      ) : entries.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)]">Ainda nao ha saldos para comparar.</p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => {
            const RankIcon = entry.rank === 1 ? Crown : entry.rank === 2 ? Medal : null;
            return (
              <Link
                key={entry.user_id}
                to={`/app/perfil/${entry.user_id}`}
                className={`flex items-center gap-2.5 rounded-[8px] px-2 py-2 transition-colors hover:bg-[var(--hover-overlay)] ${entry.is_me ? "bg-[var(--hover-overlay)]" : ""}`}
              >
                <span className="flex w-5 justify-center text-[10px] font-semibold text-[var(--text-muted)]">
                  {RankIcon ? <RankIcon className="size-3.5 text-[#c58b42]" /> : `#${entry.rank}`}
                </span>
                <Avatar entry={entry} />
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-[var(--text-primary)]">{entry.name}</span>
                <span className="shrink-0 text-[11px] font-semibold text-[#c58b42]">{Number(entry.credits || 0).toLocaleString("pt-BR")}</span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
