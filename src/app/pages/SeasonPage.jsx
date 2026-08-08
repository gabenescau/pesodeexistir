import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles, Storefront, Check } from "@/lib/icons";

const INITIAL_SEASONS = [
  {
    id: "season-1",
    name: "Season 1 Charles Bukowski",
    author: "Curadoria OPE Club",
    startDate: "01/06/2026",
    endDate: "31/08/2026",
    daysLeft: 24,
    status: "Ativa",
    coverUrl: "https://images.unsplash.com/photo-1519682577862-22b62b24e493?w=1200&q=80",
    description:
      "Uma imersão completa no universo de Bukowski. Conclua missões exclusivas, suba no ranking da temporada e resgate colecionáveis únicos.",
    stats: {
      xp: "1.250 XP",
      credits: "80 Créditos",
      missions: "1 de 3",
      position: "Posição 8",
    },
    products: [
      {
        id: "sp-1",
        name: "Livro Físico Bukowski Edição Especial",
        desc: "Edição especial com tiragem limitada e ilustrações inéditas.",
        credits: 450,
        imageUrl: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400&q=80",
        category: "book",
      },
      {
        id: "sp-2",
        name: "Livro Premium Bukowski Collector Box",
        desc: "Encadernação em capa dura especial com estojo rígido e marcador exclusivo.",
        credits: 900,
        imageUrl: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&q=80",
        category: "book_premium",
      },
      {
        id: "sp-3",
        name: "Moletom Bukowski Street Art",
        desc: "Moletom 100% algodão com bordado minimalista da Season 1.",
        credits: 2800,
        imageUrl: "https://images.unsplash.com/photo-1556821840-3a63f15732ce?w=400&q=80",
        category: "hoodie",
      },
    ],
    seasonMissions: [
      { id: "sm-1", title: "Leia uma obra de Bukowski", reward: "+50 XP", completed: true },
      { id: "sm-2", title: "Compartilhe uma frase do autor na comunidade", reward: "+30 XP", completed: false },
      { id: "sm-3", title: "Complete o Quiz Bukowski", reward: "+70 XP", completed: false },
    ],
    leaderboard: [
      { position: 1, name: "Ana Lima", xp: "4.200 XP" },
      { position: 2, name: "Pedro Alves", xp: "3.850 XP" },
      { position: 3, name: "Julia Costa", xp: "3.600 XP" },
      { position: 8, name: "Você", xp: "1.250 XP", isCurrentUser: true },
    ],
  },
];

export function SeasonPage() {
  const navigate = useNavigate();
  const [seasons, setSeasons] = useState(() => {
    try {
      const saved = localStorage.getItem("ope_seasons_config");
      return saved ? JSON.parse(saved) : INITIAL_SEASONS;
    } catch {
      return INITIAL_SEASONS;
    }
  });

  useEffect(() => {
    const handleStorage = () => {
      try {
        const saved = localStorage.getItem("ope_seasons_config");
        if (saved) setSeasons(JSON.parse(saved));
      } catch {}
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const activeSeason = seasons.find((s) => s.status === "Ativa" || s.status === "active");

  // Caso esteja desativada ou não haja season ativa
  if (!activeSeason) {
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

  const season = activeSeason;

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
          <img
            src={season.coverUrl || "https://images.unsplash.com/photo-1519682577862-22b62b24e493?w=1200&q=80"}
            alt={season.name}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />

          {/* Badges */}
          <div className="absolute top-3 left-3 flex items-center gap-2">
            <span className="rounded-[6px] border border-white/20 bg-black/60 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-white">
              Ativa
            </span>
            {season.daysLeft && (
              <span className="rounded-[6px] border border-white/20 bg-black/60 px-2.5 py-1 text-xs font-semibold text-white">
                {season.daysLeft} dias restantes
              </span>
            )}
          </div>
          <div className="absolute top-3 right-3">
            <span className="text-xs text-white/70">{season.startDate} até {season.endDate}</span>
          </div>

          <div className="absolute bottom-4 left-4 right-4">
            <p className="text-[10px] uppercase tracking-widest text-white/60 mb-1">{season.author || "Evento Especial OPE Club"}</p>
            <h1 className="text-2xl font-bold text-white leading-tight">{season.name}</h1>
            <p className="mt-1 text-sm text-white/80 line-clamp-2 max-w-lg">{season.description}</p>
          </div>
        </div>
      </div>

      {/* StatCards — padrão Admin */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">XP da Season</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{season.stats?.xp || "1.250 XP"}</p>
        </div>
        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Créditos Conquistados</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{season.stats?.credits || "80 Créditos"}</p>
        </div>
        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Missões Concluídas</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{season.stats?.missions || "1 de 3"}</p>
        </div>
        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Sua Posição</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{season.stats?.position || "Posição 8"}</p>
        </div>
      </div>

      {/* Produtos Exclusivos da Season */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Produtos Exclusivos da Season</p>
          </div>
          <p className="text-xs text-[var(--text-muted)]">Disponíveis apenas durante esta temporada</p>
        </div>

        {(!season.products || season.products.length === 0) ? (
          <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-8 text-center text-xs text-[var(--text-muted)]">
            Nenhum produto exclusivo cadastrado para esta temporada.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
            {season.products.map((prod) => (
              <div
                key={prod.id}
                onClick={() => navigate(`/app/loja/produto/${prod.id}`)}
                className="group cursor-pointer overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--border-strong)] transition-colors"
              >
                {/* Imagem retangular vertical */}
                <div className="relative aspect-[3/4] overflow-hidden bg-[var(--bg-canvas)]">
                  <img
                    src={prod.imageUrl || "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400&q=80"}
                    alt={prod.name}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                  <span className="absolute top-2 left-2 rounded-[6px] border border-white/20 bg-black/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
                    Exclusivo
                  </span>
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)] line-clamp-2">{prod.name}</p>
                    {prod.desc && <p className="mt-0.5 text-xs text-[var(--text-muted)] line-clamp-2">{prod.desc}</p>}
                  </div>
                  <div className="flex items-center justify-between border-t border-[var(--border)] pt-3">
                    <span className="text-sm font-semibold text-[var(--text-primary)]">
                      {prod.credits} créditos
                    </span>
                    <span className="text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                      Ver Produto
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Grid inferior: Missões + Ranking */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

        {/* Missões da Temporada */}
        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Missões da Temporada</p>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {(season.seasonMissions || []).map((mission) => (
              <div key={mission.id} className="flex items-start justify-between gap-4 px-4 py-3">
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border ${
                    mission.completed
                      ? "border-[var(--text-primary)] bg-[var(--text-primary)]"
                      : "border-[var(--border)] bg-[var(--bg-canvas)]"
                  }`}>
                    {mission.completed && (
                      <svg className="size-3 text-[var(--bg-card)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <p className={`text-sm ${mission.completed ? "text-[var(--text-muted)] line-through" : "text-[var(--text-primary)]"}`}>
                    {mission.title}
                  </p>
                </div>
                <span className="shrink-0 text-xs font-semibold text-[var(--text-primary)]">
                  {mission.reward}
                </span>
              </div>
            ))}
            {(!season.seasonMissions || season.seasonMissions.length === 0) && (
              <div className="p-4 text-center text-xs text-[var(--text-muted)]">
                Nenhuma missão configurada para esta temporada.
              </div>
            )}
          </div>
        </div>

        {/* Ranking da Season */}
        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Ranking da Season</p>
          </div>

          <div className="grid grid-cols-12 gap-4 px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-canvas)]">
            <p className="col-span-2 text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Pos.</p>
            <p className="col-span-6 text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Leitor</p>
            <p className="col-span-4 text-[10px] uppercase tracking-wider text-[var(--text-muted)] text-right">XP</p>
          </div>

          <div className="divide-y divide-[var(--border)]">
            {(season.leaderboard || []).map((entry, idx) => (
              <div
                key={idx}
                className={`grid grid-cols-12 gap-4 items-center px-4 py-3 ${
                  entry.isCurrentUser ? "bg-[var(--hover-overlay)]" : ""
                }`}
              >
                <span className="col-span-2 text-sm font-bold text-[var(--text-primary)]">
                  #{entry.position}
                </span>
                <p className={`col-span-6 text-sm ${entry.isCurrentUser ? "font-semibold text-[var(--text-primary)]" : "text-[var(--text-primary)]"}`}>
                  {entry.name}
                  {entry.isCurrentUser && (
                    <span className="ml-1.5 text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-normal">você</span>
                  )}
                </p>
                <p className="col-span-4 text-right text-sm font-semibold text-[var(--text-primary)]">
                  {entry.xp}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
