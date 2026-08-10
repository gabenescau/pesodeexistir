import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Sparkles, Storefront, Check, Trophy, Loader2 } from "@/lib/icons";
import { supabase, isSupabaseReady } from "@/app/data/supabase";
import { rewardApi } from "@/lib/rewards";

function daysUntil(iso) {
  if (!iso) return null;
  const end = new Date(iso);
  const now = new Date();
  return Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
}

export function SeasonPage() {
  const [season, setSeason] = useState(null);
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadSeason = useCallback(async () => {
    if (!isSupabaseReady()) {
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("seasons")
        .select("*")
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      setSeason(data || null);

      const result = await rewardApi.monthlyRanking(10);
      setRanking(Array.isArray(result?.list) ? result.list : []);
    } catch {
      setSeason(null);
      setRanking([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSeason();
  }, [loadSeason]);

  if (loading) {
    return (
      <div className="mx-auto w-full min-w-0 max-w-5xl flex-1 space-y-6">
        <Link
          to="/app/loja"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ArrowLeft className="size-4" /> Voltar para a Loja
        </Link>
        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-12 text-center">
          <Loader2 className="size-6 animate-spin text-[var(--text-muted)] mx-auto mb-2" />
          <p className="text-sm text-[var(--text-muted)]">Carregando a temporada...</p>
        </div>
      </div>
    );
  }

  if (!season) {
    return (
      <div className="mx-auto w-full min-w-0 max-w-4xl flex-1 space-y-6">
        <Link
          to="/app/loja"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ArrowLeft className="size-4" /> Voltar para a Loja
        </Link>

        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-12 text-center space-y-4">
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Season ainda não disponível</h1>
            <p className="text-sm text-[var(--text-muted)] max-w-md mx-auto">
              No momento não há nenhuma temporada ativa no OPE Club. Fique atento às nossas próximas novidades e eventos especiais!
            </p>
          </div>
          <div className="pt-2">
            <Link
              to="/app/loja"
              className="inline-flex items-center gap-2 rounded-[8px] bg-[var(--text-primary)] px-4 py-2 text-xs font-semibold text-[var(--bg-card)] hover:opacity-90 transition-opacity"
            >
              Explorar a Loja OPE
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const daysLeft = daysUntil(season.ends_on);
  const me = ranking.find((r) => r.is_me) || null;

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl flex-1 space-y-6">

      {/* Back */}
      <Link
        to="/app/loja"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
      >
        <ArrowLeft className="size-4" /> Voltar para a Loja
      </Link>

      {/* Banner Hero — Evento Especial */}
      <div className="relative overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)]">
        <div className="relative h-56 sm:h-72 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-mint)]/20 via-[var(--bg-card)] to-amber-500/10" />

          {/* Badges */}
          <div className="absolute top-3 left-3 flex items-center gap-2">
            <span className="rounded-[6px] border border-white/20 bg-black/60 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-white">
              Ativa
            </span>
            {daysLeft !== null && (
              <span className="rounded-[6px] border border-white/20 bg-black/60 px-2.5 py-1 text-xs font-semibold text-white">
                {daysLeft} dia{daysLeft !== 1 ? "s" : ""} restante{daysLeft !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          {season.ends_on && (
            <div className="absolute top-3 right-3">
              <span className="text-xs text-white/70">
                {new Date(season.starts_on).toLocaleDateString("pt-BR")} até {new Date(season.ends_on).toLocaleDateString("pt-BR")}
              </span>
            </div>
          )}

          <div className="absolute bottom-4 left-4 right-4">
            <p className="text-[10px] uppercase tracking-widest text-white/60 mb-1">Evento Especial OPE Club</p>
            <h1 className="text-2xl font-bold text-white leading-tight">{season.name}</h1>
            {season.description && (
              <p className="mt-1 text-sm text-white/80 line-clamp-2 max-w-lg">{season.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Ranking da Season */}
      <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
          <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Ranking da Season</p>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-400">
            <Trophy className="size-3.5" /> XP do mês
          </span>
        </div>

        <div className="grid grid-cols-12 gap-4 px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-canvas)]">
          <p className="col-span-2 text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Pos.</p>
          <p className="col-span-6 text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Leitor</p>
          <p className="col-span-4 text-[10px] uppercase tracking-wider text-[var(--text-muted)] text-right">XP</p>
        </div>

        <div className="divide-y divide-[var(--border)]">
          {ranking.map((entry) => (
            <div
              key={entry.user_id}
              className={`grid grid-cols-12 gap-4 items-center px-4 py-3 ${entry.is_me ? "bg-[var(--hover-overlay)]" : ""}`}
            >
              <span className="col-span-2 text-sm font-bold text-[var(--text-primary)]">#{entry.rank}</span>
              <p className={`col-span-6 text-sm truncate ${entry.is_me ? "font-semibold text-[var(--text-primary)]" : "text-[var(--text-primary)]"}`}>
                {entry.name}
                {entry.is_me && (
                  <span className="ml-1.5 text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-normal">você</span>
                )}
              </p>
              <p className="col-span-4 text-right text-sm font-semibold text-[var(--text-primary)]">
                {Number(entry.xp).toLocaleString("pt-BR")} XP
              </p>
            </div>
          ))}

          {me && me.rank > 10 && (
            <div className="grid grid-cols-12 gap-4 items-center px-4 py-3 bg-[var(--hover-overlay)]">
              <span className="col-span-2 text-sm font-bold text-[var(--text-primary)]">#{me.rank}</span>
              <p className="col-span-6 text-sm font-semibold text-[var(--text-primary)] truncate">Você</p>
              <p className="col-span-4 text-right text-sm font-semibold text-[var(--text-primary)]">
                {Number(me.xp).toLocaleString("pt-BR")} XP
              </p>
            </div>
          )}

          {ranking.length === 0 && (
            <div className="p-8 text-center text-xs text-[var(--text-muted)]">
              Nenhum XP registrado nesta temporada ainda. Comece lendo e completando missões!
            </div>
          )}
        </div>
      </div>

      {/* Grid informativo: Regras + Lembretes */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

        {/* Regras da Temporada */}
        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border)] flex items-center gap-2">
            <Sparkles className="size-4 text-[var(--accent-mint)]" />
            <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Como participar</p>
          </div>
          <div className="divide-y divide-[var(--border)]">
            <div className="flex items-start gap-3 px-4 py-3">
              <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-[var(--text-primary)] bg-[var(--text-primary)]">
                <Check className="size-3 text-[var(--bg-card)]" />
              </div>
              <p className="text-sm text-[var(--text-primary)]">Ganhe XP lendo livros, completando missões e participando da comunidade.</p>
            </div>
            <div className="flex items-start gap-3 px-4 py-3">
              <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-canvas)]">
                <Check className="size-3 text-transparent" />
              </div>
              <p className="text-sm text-[var(--text-primary)]">O ranking reflete o XP acumulado no mês corrente e zera no dia 1º.</p>
            </div>
            <div className="flex items-start gap-3 px-4 py-3">
              <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-canvas)]">
                <Check className="size-3 text-transparent" />
              </div>
              <p className="text-sm text-[var(--text-primary)]">Os melhores colocados são reconhecidos na comunidade e em nossos canais oficiais.</p>
            </div>
          </div>
        </div>

        {/* Lembretes */}
        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-5 flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <Storefront className="size-5 shrink-0 text-[var(--accent-mint)] mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">Produtos e missões chegam em breve</p>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                Produtos exclusivos e missões especiais desta temporada serão anunciados aqui.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Trophy className="size-5 shrink-0 text-amber-400 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                {me ? `Você está na posição #${me.rank} com ${Number(me.xp).toLocaleString("pt-BR")} XP` : "Entre no ranking ainda este mês"}
              </p>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                Continue participando para subir de posição antes do fim da temporada.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
