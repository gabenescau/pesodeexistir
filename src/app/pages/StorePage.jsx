import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Storefront, Truck, ChevronRight, ArrowRight } from "@/lib/icons";
import { useRewards } from "@/app/data/RewardsContext";
import { toast } from "@/lib/toast";
import { CheckoutModal } from "@/app/components/CheckoutModal";

const CATEGORY_LABELS = {
  book: "Livros",
  book_premium: "Livros Premium",
  boxes: "Boxes",
  oversized: "Oversizeds",
  hoodie: "Moletons",
  collectibles: "Colecionáveis",
};

const CATEGORY_TABS = [
  { id: "all", label: "Todos" },
  { id: "book_premium", label: "Livros Premium" },
  { id: "book", label: "Livros" },
  { id: "boxes", label: "Boxes" },
  { id: "oversized", label: "Oversizeds" },
  { id: "hoodie", label: "Moletons" },
];

const DUAL_PAYMENT_CATEGORIES = ["oversized", "hoodie"];

function getProductImages(product) {
  if (!product) return [];
  const rawImages =
    Array.isArray(product.images) && product.images.length > 0
      ? product.images
      : typeof product.images === "string" && product.images.startsWith("[")
        ? JSON.parse(product.images || "[]")
        : product.image_url
          ? [product.image_url]
          : [];
  return rawImages.length > 0 ? rawImages : product.image_url ? [product.image_url] : [];
}

function getDropConfig() {
  try {
    const saved = localStorage.getItem("ope_novo_drop_config");
    if (saved) return JSON.parse(saved);
  } catch {}
  return { active: true, productIds: [] };
}

function DropBannerSection({ products }) {
  const navigate = useNavigate();
  const config = useMemo(() => getDropConfig(), []);

  if (!config.active) return null;

  const dropProducts = config.productIds.length > 0
    ? products.filter((p) => config.productIds.includes(p.id))
    : products.slice(0, 4);

  if (dropProducts.length === 0) return null;

  const featured = dropProducts[0];
  const rest = dropProducts.slice(1);
  const featuredImages = getProductImages(featured);
  const featuredRealPrice = featured.real_price ||
    (featured.category === "oversized" ? 189.90 : featured.category === "hoodie" ? 289.90 : 0);
  const isDual = DUAL_PAYMENT_CATEGORIES.includes(featured.category);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-4 w-[3px] rounded-full bg-[var(--text-primary)]" />
          <p className="text-sm font-bold text-[var(--text-primary)]">Novo Drop Disponível</p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/app/loja")}
          className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          Ver tudo <ArrowRight className="size-3" />
        </button>
      </div>

      <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-1" style={{ scrollbarWidth: "none" }}>
        {/* Featured — grande */}
        <div
          onClick={() => navigate(`/app/loja/produto/${featured.id}`)}
          className="group relative shrink-0 snap-start w-[68%] sm:w-[280px] cursor-pointer overflow-hidden rounded-[14px] border border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--border-strong)] transition-all"
        >
          <div className="aspect-[3/4] overflow-hidden bg-[var(--bg-canvas)]">
            {featuredImages.length > 0 ? (
              <img src={featuredImages[0]} alt={featured.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
            ) : (
              <div className="flex h-full items-center justify-center"><Storefront className="size-10 text-[var(--text-muted)]" /></div>
            )}
          </div>
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-white/60">{CATEGORY_LABELS[featured.category] || featured.category}</p>
            <p className="text-sm font-bold text-white leading-tight mt-0.5 line-clamp-2">{featured.name}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-xs font-semibold text-white/90">{featured.credits_cost?.toLocaleString("pt-BR")} créditos</span>
              {isDual && featuredRealPrice > 0 && <span className="text-[10px] text-white/50">ou R$ {featuredRealPrice.toFixed(2)}</span>}
            </div>
          </div>
          <div className="absolute top-3 left-3">
            <span className="rounded-[6px] bg-white/10 backdrop-blur-sm border border-white/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">Drop</span>
          </div>
        </div>

        {/* Itens menores */}
        {rest.map((p) => {
          const imgs = getProductImages(p);
          const rp = p.real_price || (p.category === "oversized" ? 189.90 : p.category === "hoodie" ? 289.90 : 0);
          return (
            <div
              key={p.id}
              onClick={() => navigate(`/app/loja/produto/${p.id}`)}
              className="group relative shrink-0 snap-start w-[46%] sm:w-[185px] cursor-pointer overflow-hidden rounded-[14px] border border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--border-strong)] transition-all"
            >
              <div className="aspect-[3/4] overflow-hidden bg-[var(--bg-canvas)]">
                {imgs.length > 0
                  ? <img src={imgs[0]} alt={p.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                  : <div className="flex h-full items-center justify-center"><Storefront className="size-7 text-[var(--text-muted)]" /></div>
                }
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-3">
                <p className="text-xs font-bold text-white leading-tight line-clamp-2">{p.name}</p>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="text-[10px] text-white/80">{p.credits_cost?.toLocaleString("pt-BR")} cr.</span>
                  {DUAL_PAYMENT_CATEGORIES.includes(p.category) && rp > 0 && <span className="text-[9px] text-white/50">ou R$ {rp.toFixed(2)}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProductCard({ product, onRedeem }) {
  const navigate = useNavigate();
  const { wallet } = useRewards();
  const credits = wallet?.credits ?? 0;
  const affordable = credits >= product.credits_cost;
  const images = getProductImages(product);
  const isDual = DUAL_PAYMENT_CATEGORIES.includes(product.category);
  const realPrice = product.real_price ||
    (product.category === "oversized" ? 189.90 : product.category === "hoodie" ? 289.90 : 0);

  return (
    <div
      onClick={() => navigate(`/app/loja/produto/${product.id}`)}
      className="group flex cursor-pointer flex-col rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden hover:border-[var(--border-strong)] transition-colors"
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-[var(--bg-canvas)]">
        {images.length > 0 ? (
          <img src={images[0]} alt={product.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[var(--text-muted)]"><Storefront className="size-8" /></div>
        )}
        <span className="absolute top-2 left-2 rounded-[6px] border border-[var(--border)] bg-[var(--bg-card)]/90 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          {CATEGORY_LABELS[product.category] || product.category}
        </span>
      </div>

      <div className="px-3 pt-2.5 pb-3 space-y-2 flex-1 flex flex-col">
        <h3 className="text-xs font-semibold text-[var(--text-primary)] leading-snug line-clamp-2 flex-1">{product.name}</h3>
        <div className="space-y-0.5">
          <p className="text-xs text-[var(--text-muted)]">{product.credits_cost?.toLocaleString("pt-BR")} créditos</p>
          {isDual && realPrice > 0 && <p className="text-[11px] text-[var(--text-muted)]">ou R$ {realPrice.toFixed(2)}</p>}
        </div>
        <button
          type="button"
          disabled={!affordable}
          onClick={(e) => { e.stopPropagation(); onRedeem(product); }}
          className="w-full rounded-[8px] border border-[var(--border)] px-3 py-1.5 text-[11px] font-semibold text-[var(--text-primary)] hover:bg-[var(--hover-overlay)] transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        >
          {affordable ? "Resgatar" : "Insuficiente"}
        </button>
      </div>
    </div>
  );
}

export function StorePage() {
  const { wallet, products, loading, redeemProduct, refresh } = useRewards();
  const [activeCategory, setActiveCategory] = useState("all");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  useEffect(() => { refresh().catch(() => {}); }, [refresh]);

  const availableCategories = useMemo(() => {
    const cats = new Set(products.map((p) => p.category));
    return CATEGORY_TABS.filter((t) => t.id === "all" || cats.has(t.id));
  }, [products]);

  const filtered = activeCategory === "all" ? products : products.filter((p) => p.category === activeCategory);

  function handleRedeem(product) { setSelectedProduct(product); setCheckoutOpen(true); }

  async function handleCheckoutConfirm(order) {
    if (!selectedProduct) return;
    try {
      await redeemProduct(selectedProduct.id, order.customer.name, order.customer.email,
        { linha1: `${order.address.street}, ${order.address.number} — ${order.address.city}/${order.address.state}` });
      refresh().catch(() => {});
    } catch (err) {
      toast.error(err?.message || "Não foi possível realizar o resgate.");
      throw err;
    }
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl flex-1 space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] sm:text-2xl">Loja OPE</h1>
          <p className="mt-0.5 text-sm text-[var(--text-muted)]">Troque seus créditos por produtos exclusivos.</p>
        </div>
        <Link
          to="/app/missoes"
          className="flex items-center gap-1.5 shrink-0 rounded-[8px] border border-[var(--border)] bg-[var(--hover-overlay)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-colors"
        >
          <span className="font-bold text-[var(--text-primary)]">{wallet?.credits ?? 0}</span>
          <span className="text-[var(--text-muted)]">créditos</span>
          <ChevronRight className="size-3.5 text-[var(--text-muted)]" />
        </Link>
      </div>

      {/* Novo Drop Disponível */}
      {!loading && products.length > 0 && <DropBannerSection products={products} />}

      {/* Tabs de Categoria */}
      <div className="flex gap-0 overflow-x-auto border-b border-[var(--border)] pb-0" style={{ scrollbarWidth: "none" }}>
        {availableCategories.map((tab) => {
          const isActive = activeCategory === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveCategory(tab.id)}
              className={`shrink-0 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                isActive
                  ? "text-[var(--text-primary)] border-[var(--text-primary)] font-semibold"
                  : "text-[var(--text-muted)] border-transparent hover:text-[var(--text-secondary)]"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Grid de Produtos */}
      {loading ? (
        <p className="text-xs text-[var(--text-muted)]">Carregando catálogo...</p>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)]">Nenhum produto nesta categoria.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filtered.map((product) => (
            <ProductCard key={product.id} product={product} onRedeem={handleRedeem} />
          ))}
        </div>
      )}

      {/* Rodapé */}
      <div className="flex items-center justify-between rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3">
        <div className="flex items-center gap-2">
          <Truck className="size-4 text-[var(--text-muted)]" />
          <p className="text-xs font-medium text-[var(--text-primary)]">Confira seus resgates já realizados</p>
        </div>
        <Link to="/app/meus-resgates" className="text-xs font-semibold text-[var(--text-primary)] hover:opacity-70 transition-opacity">
          Ver Meus Resgates
        </Link>
      </div>

      <CheckoutModal
        isOpen={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        product={selectedProduct}
        paymentMethod="credits"
        onConfirm={handleCheckoutConfirm}
      />
    </div>
  );
}

