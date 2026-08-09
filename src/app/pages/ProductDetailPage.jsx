import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { Storefront, ArrowLeft, Check, ShieldCheck, CreditCard, Coins } from "@/lib/icons";
import { useRewards } from "@/app/data/RewardsContext";
import { toast } from "@/lib/toast";
import { CheckoutModal } from "@/app/components/CheckoutModal";

const CATEGORY_LABELS = {
  book: "Livro Físico",
  livro_fisico: "Livro Físico",
  book_premium: "Livro Premium",
  livro_premium: "Livro Premium",
  boxes: "Boxes",
  oversized: "Oversized",
  hoodie: "Moletom",
  moletom: "Moletom",
  collectibles: "Colecionáveis",
};

// These categories support dual payment (credits + real money)
const DUAL_PAYMENT_CATEGORIES = ["oversized", "hoodie", "moletom"];

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

export function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { wallet, products, redeemProduct, refresh } = useRewards();
  const [activeImgIdx, setActiveImgIdx] = useState(0);
  const [selectedPayment, setSelectedPayment] = useState("credits");
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    setActiveImgIdx(0);
  }, [id]);

  const product = useMemo(
    () => products.find((p) => String(p.id) === String(id)),
    [products, id]
  );

  const credits = wallet?.credits ?? 0;
  const affordable = product ? credits >= product.credits_cost : false;
  const images = useMemo(() => getProductImages(product), [product]);
  const progressPercent = product ? Math.min(100, Math.round((credits / product.credits_cost) * 100)) : 0;
  const missingCredits = product ? Math.max(0, product.credits_cost - credits) : 0;
  const isDualPayment = product ? DUAL_PAYMENT_CATEGORIES.includes(product.category) : false;
  const realPrice = product?.real_price || (product?.category === "oversized" ? 189.90 : product?.category === "hoodie" ? 289.90 : 0);
  const hasRealPrice = realPrice > 0;

  const similarProducts = useMemo(() => {
    if (!product) return [];
    return products.filter(
      (p) => p.category === product.category && String(p.id) !== String(product.id)
    );
  }, [products, product]);

  async function handleCheckoutConfirm(order) {
    if (order.paymentMethod === "credits") {
      try {
        await redeemProduct(
          product.id,
          order.customer.name,
          order.customer.email,
          { linha1: `${order.address.street}, ${order.address.number} — ${order.address.city}/${order.address.state}` }
        );
        refresh().catch(() => {});
      } catch (err) {
        toast.error(err?.message || "Não foi possível realizar o resgate.");
        throw err;
      }
    }
  }

  function handleOpenCheckout() {
    if (selectedPayment === "real") {
      toast.info("Módulo de Gateway de Pagamento: A integração de pagamento em dinheiro real (Pix / Cartão de Crédito) será conectada em breve.");
      return;
    }
    setCheckoutOpen(true);
  }

  if (!product) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4 py-16 text-center">
        <p className="text-sm text-[var(--text-muted)]">Produto não encontrado.</p>
        <Link
          to="/app/loja"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--text-primary)] hover:underline"
        >
          <ArrowLeft className="size-4" /> Voltar para a Loja
        </Link>
      </div>
    );
  }

  const canBuyWithCredits = affordable;

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl flex-1 space-y-8">

      {/* Back link */}
      <Link
        to="/app/loja"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
      >
        <ArrowLeft className="size-4" /> Voltar para a Loja
      </Link>

      {/* Layout Principal */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">

        {/* Coluna Esquerda — Imagem principal */}
        <div className="space-y-4 lg:col-span-7">
          <div className="overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] aspect-[3/4] max-h-[520px] w-full mx-auto">
            {images.length > 0 ? (
              <img
                src={images[activeImgIdx] || images[0]}
                alt={product.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[var(--text-muted)]">
                <Storefront className="size-12" />
              </div>
            )}
          </div>

          {/* Informações do item */}
          <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-4 space-y-3">
            <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Informações do Item</p>
            <div className="space-y-2 text-sm text-[var(--text-muted)]">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                <span>Categoria</span>
                <span className="font-medium text-[var(--text-primary)]">
                  {CATEGORY_LABELS[product.category] || product.category}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                <span>Edição</span>
                <span className="font-medium text-[var(--text-primary)]">Oficial OPE Club</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Envio</span>
                <span className="font-medium text-[var(--text-primary)]">Grátis para todo o Brasil</span>
              </div>
            </div>
          </div>
        </div>

        {/* Coluna Direita — Card de Resgate */}
        <div className="lg:col-span-5">
          <div className="sticky top-20 space-y-4 rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-5">

            <div>
              <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">
                {CATEGORY_LABELS[product.category] || product.category}
              </p>
              <h1 className="mt-1 text-xl font-bold text-[var(--text-primary)] leading-tight">
                {product.name}
              </h1>
            </div>

            {/* Valor — dual (créditos + real) ou só créditos */}
            {isDualPayment && hasRealPrice ? (
              <div className="border-t border-[var(--border)] pt-4 space-y-2">

                {/* Linha — Créditos OPE */}
                <button
                  type="button"
                  onClick={() => setSelectedPayment("credits")}
                  className={`w-full flex items-center justify-between rounded-[10px] border px-4 py-3 transition-colors ${
                    selectedPayment === "credits"
                      ? "border-[var(--text-primary)] bg-[var(--hover-overlay)]"
                      : "border-[var(--border)] hover:border-[var(--border-strong)]"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Coins className={`size-4 shrink-0 ${selectedPayment === "credits" ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`} />
                    <span className={`text-sm font-medium ${selectedPayment === "credits" ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}>
                      Créditos OPE
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${selectedPayment === "credits" ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}>
                      {product.credits_cost.toLocaleString("pt-BR")}
                    </span>
                    <div className={`size-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                      selectedPayment === "credits" ? "border-[var(--text-primary)]" : "border-[var(--border)]"
                    }`}>
                      {selectedPayment === "credits" && <div className="size-2 rounded-full bg-[var(--text-primary)]" />}
                    </div>
                  </div>
                </button>

                {/* Linha — Dinheiro Real */}
                <button
                  type="button"
                  onClick={() => setSelectedPayment("real")}
                  className={`w-full flex items-center justify-between rounded-[10px] border px-4 py-3 transition-colors ${
                    selectedPayment === "real"
                      ? "border-[var(--text-primary)] bg-[var(--hover-overlay)]"
                      : "border-[var(--border)] hover:border-[var(--border-strong)]"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <CreditCard className={`size-4 shrink-0 ${selectedPayment === "real" ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`} />
                    <div>
                      <span className={`text-sm font-medium block leading-tight ${selectedPayment === "real" ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}>
                        Dinheiro Real
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)] leading-tight">Visa · Mastercard · Pix</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${selectedPayment === "real" ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}>
                      R$ {realPrice.toFixed(2)}
                    </span>
                    <div className={`size-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                      selectedPayment === "real" ? "border-[var(--text-primary)]" : "border-[var(--border)]"
                    }`}>
                      {selectedPayment === "real" && <div className="size-2 rounded-full bg-[var(--text-primary)]" />}
                    </div>
                  </div>
                </button>

              </div>
            ) : (
              /* Preço simples — créditos */
              <div className="border-t border-[var(--border)] pt-4">
                <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Custo</p>
                <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">
                  {product.credits_cost.toLocaleString("pt-BR")}{" "}
                  <span className="text-sm font-normal text-[var(--text-muted)]">créditos</span>
                </p>
              </div>
            )}

            {/* Progresso — só mostra se estiver pagando com créditos */}
            {selectedPayment === "credits" && (
              <div className="border-t border-[var(--border)] pt-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                  <span>Seu progresso</span>
                  <span className="font-semibold text-[var(--text-primary)]">{progressPercent}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-[var(--hover-overlay)]">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="text-xs text-[var(--text-muted)]">
                  {affordable ? (
                    <span className="font-semibold text-blue-400">
                      Você tem créditos suficientes ✓
                    </span>
                  ) : (
                    `Faltam ${missingCredits} créditos`
                  )}
                </p>
              </div>
            )}

            {/* Descrição */}
            {product.description && (
              <div className="border-t border-[var(--border)] pt-4">
                <p className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-1">Sobre</p>
                <p className="text-sm text-[var(--text-muted)] leading-relaxed">{product.description}</p>
              </div>
            )}

            {/* Disponibilidade */}
            <div className="border-t border-[var(--border)] pt-4 space-y-1.5 text-xs text-[var(--text-muted)]">
              <div className="flex items-center gap-2">
                <Check className="size-3.5 text-[var(--text-primary)]" />
                <span className="font-semibold text-[var(--text-primary)]">Produto Disponível</span>
              </div>
              <p>Envio com código de rastreamento para todo o Brasil.</p>
            </div>

            {/* Botão de Compra */}
            <div className="border-t border-[var(--border)] pt-4">
              {selectedPayment === "credits" ? (
                <button
                  type="button"
                  disabled={!canBuyWithCredits}
                  onClick={handleOpenCheckout}
                  className="w-full rounded-[10px] bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {canBuyWithCredits ? "Resgatar com Créditos" : "Créditos Insuficientes"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleOpenCheckout}
                  className="w-full rounded-[10px] bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
                >
                  Comprar com Dinheiro Real
                </button>
              )}
            </div>

            {/* Garantia */}
            <div className="flex items-start gap-2 text-xs text-[var(--text-muted)]">
              <ShieldCheck className="size-3.5 shrink-0 mt-0.5 text-[var(--text-primary)]" />
              <span>Garantia OPE Club. Entrega garantida e suporte direto com a equipe.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Fotos do Produto */}
      {images.length > 1 && (
        <div className="space-y-4 border-t border-[var(--border)] pt-8">
          <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Fotos do Produto</p>
          <div
            className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 sm:grid sm:grid-cols-4 sm:overflow-visible"
            style={{ scrollbarWidth: "none" }}
          >
            {images.map((imgUrl, idx) => (
              <div
                key={idx}
                onClick={() => setActiveImgIdx(idx)}
                className={`w-[60%] shrink-0 snap-center sm:w-auto overflow-hidden rounded-[12px] border aspect-[3/4] cursor-pointer transition-colors ${
                  activeImgIdx === idx
                    ? "border-[var(--text-primary)]"
                    : "border-[var(--border)] hover:border-[var(--border-strong)]"
                }`}
              >
                <img src={imgUrl} alt={`${product.name} ${idx + 1}`} className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Itens Semelhantes */}
      {similarProducts.length > 0 && (
        <div className="space-y-5 border-t border-[var(--border)] pt-8">
          <div>
            <p className="text-base font-bold text-[var(--text-primary)]">Itens Semelhantes</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Outros produtos da categoria{" "}
              <span className="font-medium text-[var(--text-secondary)]">{CATEGORY_LABELS[product.category] || product.category}</span>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {similarProducts.map((simProd) => {
              const simImages = getProductImages(simProd);
              const simRealPrice = simProd.real_price || (simProd.category === "oversized" ? 189.90 : simProd.category === "hoodie" ? 289.90 : 0);
              const simIsDual = DUAL_PAYMENT_CATEGORIES.includes(simProd.category);
              return (
                <div
                  key={simProd.id}
                  onClick={() => navigate(`/app/loja/produto/${simProd.id}`)}
                  className="group cursor-pointer overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--border-strong)] transition-all duration-200"
                >
                  {/* Imagem */}
                  <div className="aspect-[3/4] overflow-hidden bg-[var(--bg-canvas)]">
                    {simImages.length > 0 ? (
                      <img
                        src={simImages[0]}
                        alt={simProd.name}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Storefront className="size-6 text-[var(--text-muted)]" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-3 space-y-1">
                    <p className="text-xs font-semibold text-[var(--text-primary)] line-clamp-2 leading-snug">{simProd.name}</p>
                    <div className="flex flex-col gap-0.5">
                      <p className="text-[11px] text-[var(--text-muted)]">{simProd.credits_cost?.toLocaleString("pt-BR")} créditos</p>
                      {simIsDual && simRealPrice > 0 && (
                        <p className="text-[11px] text-[var(--text-muted)]">ou R$ {simRealPrice.toFixed(2)}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      <CheckoutModal
        isOpen={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        product={product}
        paymentMethod={selectedPayment}
        onConfirm={handleCheckoutConfirm}
      />
    </div>
  );
}
