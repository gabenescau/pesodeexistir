import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  Coins,
  Loader2,
  Sparkles,
  Storefront,
} from "@/lib/icons";
import { loadActiveSeasonCatalog } from "@/lib/catalog-api";
import { useRewards } from "@/app/data/RewardsContext";

function daysUntil(iso) {
  if (!iso) return null;
  return Math.max(0, Math.ceil((new Date(iso) - new Date()) / 86400000));
}

function money(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function ProductTile({ product }) {
  return (
    <Link
      to={`/app/loja/produto/${product.id}`}
      className="group flex min-w-0 flex-col overflow-hidden rounded-[14px] border border-white/10 bg-[#111111] transition-colors hover:border-[#c58b42]/70"
    >
      <div className="aspect-[4/5] overflow-hidden bg-[#1a1714]">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[#c58b42]">
            <Storefront className="size-8" />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="min-h-12">
          <h3 className="text-sm font-semibold leading-tight text-[#f4eee5]">{product.name}</h3>
          {product.description && (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#a69b8f]">{product.description}</p>
          )}
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className="inline-flex items-center gap-1 font-semibold text-[#e6b15c]">
            <Coins className="size-3.5" /> {Number(product.credits_cost || 0).toLocaleString("pt-BR")} creditos
          </span>
          {Number(product.real_price || 0) > 0 && (
            <span className="text-[#a69b8f]">ou {money(product.real_price)}</span>
          )}
        </div>
        <span className="inline-flex items-center justify-between border-t border-white/10 pt-3 text-xs font-semibold text-[#f4eee5]">
          Ver item <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  );
}

export function SeasonPage() {
  const { wallet } = useRewards() || {};
  const [season, setSeason] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadSeason = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await loadActiveSeasonCatalog();
      setSeason(data.season || null);
      setProducts(data.products || []);
    } catch (loadError) {
      setError(loadError?.message || "Nao foi possivel carregar a season.");
      setSeason(null);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSeason();
  }, [loadSeason]);

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center py-20">
        <div className="flex items-center gap-3 text-sm text-[var(--text-muted)]">
          <Loader2 className="size-5 animate-spin" /> Carregando a season...
        </div>
      </div>
    );
  }

  if (!season) {
    return (
      <div className="mx-auto w-full max-w-4xl flex-1 space-y-6">
        <Link to="/app/loja" className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]">
          <ArrowLeft className="size-4" /> Voltar para a loja
        </Link>
        <section className="overflow-hidden rounded-[18px] border border-white/10 bg-[#111111] p-8 sm:p-12">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#c58b42]">OPE Club / Season</p>
          <h1 className="mt-4 max-w-xl text-3xl font-semibold tracking-[-0.03em] text-[#f4eee5] sm:text-5xl">Nenhuma season ativa agora.</h1>
          <p className="mt-4 max-w-lg text-sm leading-7 text-[#a69b8f]">O proximo ciclo aparece aqui assim que o admin publicar uma temporada.</p>
        </section>
      </div>
    );
  }

  const daysLeft = daysUntil(season.ends_on);

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 space-y-8 pb-10">
      <div className="flex items-center justify-between gap-4">
        <Link to="/app/loja" className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]">
          <ArrowLeft className="size-4" /> Voltar para a loja
        </Link>
        <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#c58b42]">
          <Sparkles className="size-4" /> Season ativa
        </span>
      </div>

      <section className="relative isolate overflow-hidden rounded-[20px] border border-[#c58b42]/35 bg-[#171513]">
        <div className="grid min-h-[420px] lg:grid-cols-[1.05fr_0.95fr]">
          <div className="relative z-10 flex flex-col justify-between p-7 sm:p-10 lg:p-12">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#e6b15c]">OPE Club presents</p>
              <h1 className="mt-5 max-w-2xl text-5xl font-semibold leading-[0.92] tracking-[-0.055em] text-[#f4eee5] sm:text-7xl">{season.name}</h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-[#c2b7aa]">{season.description || "Uma colecao para quem prefere a verdade sem enfeite."}</p>
            </div>
            <div className="mt-10 grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="border-t border-white/15 pt-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-[#8f8377]">Seu saldo</p>
                <p className="mt-1 inline-flex items-center gap-1.5 text-lg font-semibold text-[#e6b15c]"><Coins className="size-4" /> {Number(wallet?.credits || 0).toLocaleString("pt-BR")}</p>
              </div>
              <div className="border-t border-white/15 pt-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-[#8f8377]">Itens da colecao</p>
                <p className="mt-1 text-lg font-semibold text-[#f4eee5]">{products.length}</p>
              </div>
              <div className="col-span-2 border-t border-white/15 pt-3 sm:col-span-1">
                <p className="text-[10px] uppercase tracking-[0.18em] text-[#8f8377]">Termina em</p>
                <p className="mt-1 inline-flex items-center gap-1.5 text-lg font-semibold text-[#f4eee5]"><CalendarDays className="size-4" /> {daysLeft === null ? "sem data" : `${daysLeft} dias`}</p>
              </div>
            </div>
          </div>
          <div className="relative min-h-[300px] overflow-hidden bg-[#090909] lg:min-h-0">
            <img src="/autores/bukowski.jpg" alt="Charles Bukowski" className="absolute inset-0 h-full w-full object-cover object-center opacity-80 grayscale" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#171513] via-transparent to-black/20 lg:bg-gradient-to-r lg:from-[#171513]/35 lg:via-transparent lg:to-transparent" />
            <div className="absolute bottom-6 right-6 max-w-[180px] text-right text-xs leading-5 text-[#f4eee5]/80">"Encontre o que voce ama e deixe isso te matar."<span className="mt-2 block text-[10px] uppercase tracking-[0.18em] text-[#e6b15c]">Bukowski</span></div>
          </div>
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div>
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c58b42]">Colecao da season</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">Itens para levar a leitura com voce.</h2>
            </div>
            <Link to="/app/loja" className="hidden items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] sm:inline-flex">Ver loja <ArrowRight className="size-3.5" /></Link>
          </div>
          {error && <p className="mb-4 rounded-[10px] border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
          {products.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{products.map((product) => <ProductTile key={product.id} product={product} />)}</div>
          ) : (
            <div className="rounded-[14px] border border-dashed border-[var(--border)] p-10 text-center">
              <Storefront className="mx-auto size-7 text-[var(--text-muted)]" />
              <p className="mt-3 text-sm font-semibold text-[var(--text-primary)]">A colecao esta sendo preparada.</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">O admin ainda nao vinculou produtos a esta season.</p>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-[14px] border border-[var(--border)] bg-[var(--bg-card)] p-5">
            <div className="flex items-center gap-2 text-[var(--text-primary)]"><Coins className="size-4 text-[#c58b42]" /><h3 className="text-sm font-semibold">Como funciona</h3></div>
            <div className="mt-4 space-y-3 text-sm leading-6 text-[var(--text-muted)]">
              <p className="flex gap-2"><Check className="mt-1 size-4 shrink-0 text-[#c58b42]" />Ganhe creditos lendo e participando.</p>
              <p className="flex gap-2"><Check className="mt-1 size-4 shrink-0 text-[#c58b42]" />Use creditos ou compre por dinheiro.</p>
              <p className="flex gap-2"><Check className="mt-1 size-4 shrink-0 text-[#c58b42]" />Os itens ficam disponiveis enquanto houver estoque.</p>
            </div>
          </div>
          <div className="rounded-[14px] border border-[#c58b42]/30 bg-[#171513] p-5">
            <BookOpen className="size-5 text-[#e6b15c]" />
            <h3 className="mt-4 text-lg font-semibold text-[#f4eee5]">Leia. Participe. Escolha.</h3>
            <p className="mt-2 text-sm leading-6 text-[#a69b8f]">Os creditos tornam a loja acessivel sem transformar a comunidade em uma corrida de XP.</p>
          </div>
        </aside>
      </section>
    </div>
  );
}
