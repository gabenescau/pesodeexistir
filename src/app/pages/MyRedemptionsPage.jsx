import { useEffect } from "react";
import { ArrowLeft, Package } from "@/lib/icons";
import { Link } from "react-router-dom";
import { useRewards } from "@/app/data/RewardsContext";

const STATUS_LABELS = {
  pending: "Aguardando envio",
  processing: "Em processamento",
  shipped: "Enviado",
  fulfilled: "Entregue",
  rejected: "Recusado",
  refunded: "Créditos devolvidos",
};

const STATUS_STYLES = {
  pending: "bg-[var(--hover-overlay)] text-[var(--text-secondary)]",
  processing: "bg-[var(--hover-overlay)] text-[var(--text-secondary)]",
  shipped: "bg-[var(--accent-mint)]/10 text-[var(--accent-mint)]",
  fulfilled: "bg-[var(--accent-mint)]/10 text-[var(--accent-mint)]",
  rejected: "bg-red-500/10 text-red-500",
  refunded: "bg-[var(--hover-overlay)] text-[var(--text-muted)]",
};

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function MyRedemptionsPage() {
  const { myRedemptions, products, loadMyRedemptions, loadProducts } = useRewards();

  useEffect(() => {
    Promise.allSettled([loadMyRedemptions(), loadProducts()]);
  }, [loadMyRedemptions, loadProducts]);

  const productById = new Map((products || []).map((p) => [p.id, p]));

  return (
    <div className="mx-auto w-full min-w-0 max-w-2xl flex-1 space-y-5 sm:space-y-6 2xl:mx-0">
      <div>
        <Link to="/app/loja" className="mb-2 inline-flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]">
          <ArrowLeft className="size-4" /> Voltar para a loja
        </Link>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Meus resgates</h1>
        <p className="text-sm text-[var(--text-muted)]">Acompanhe o status dos seus pedidos.</p>
      </div>

      {myRedemptions.length === 0 ? (
        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-8 text-center">
          <Package className="mx-auto mb-3 size-7 text-[var(--text-muted)]" />
          <p className="text-sm text-[var(--text-secondary)]">Você ainda não fez nenhum resgate.</p>
          <Link to="/app/loja" className="mt-3 inline-block text-sm font-medium text-[var(--accent-mint)] hover:underline">
            Explorar a loja
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {myRedemptions.map((r) => {
            const product = productById.get(r.product_id);
            return (
              <div key={r.id} className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                      {product?.name || "Produto"}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {r.credits_spent} créditos · {formatDate(r.created_at)}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[r.status] || STATUS_STYLES.pending}`}>
                    {STATUS_LABELS[r.status] || r.status}
                  </span>
                </div>
                {r.tracking_code && (
                  <p className="mt-2 text-xs text-[var(--text-secondary)]">
                    Código de rastreio: <span className="font-medium text-[var(--text-primary)]">{r.tracking_code}</span>
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}