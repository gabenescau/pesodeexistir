import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/app/data/AuthContext";
import { createCheckout, PLANS } from "@/lib/abacatepay";
import { Check, CreditCard, Loader2, Lock, QrCode, X } from "@/lib/icons";

const BENEFITS = [
  "Acesso completo à biblioteca",
  "Comunidade exclusiva de leitores",
  "Comentários e clubes de leitura",
  "Lançamentos semanais",
  "Sem anúncios",
];

export function SubscribeModal({
  open,
  onClose,
  dismissible = true,
  title = "Conteudo exclusivo para assinantes",
  description = "Assine o OPE Club para desbloquear a biblioteca e a comunidade.",
  benefits = BENEFITS,
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState("monthly");
  const [paymentMethod, setPaymentMethod] = useState("PIX");
  const [creating, setCreating] = useState(null);
  const [error, setError] = useState(null);

  if (!open) return null;

  async function assinar(plan) {
    if (!user) {
      navigate("/entrar");
      return;
    }

    setCreating(plan);
    setError(null);

    try {
      const data = await createCheckout({
        plan,
        name: user.email?.split("@")[0] || "",
        paymentMethod,
      });
      window.location.assign(data.url);
    } catch (e) {
      setError(e.message);
      setCreating(null);
    }
  }

  const plan = PLANS[selectedPlan];
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Fechar"
        onClick={dismissible ? onClose : undefined}
        className="absolute inset-0 z-0 cursor-default bg-black/60 backdrop-blur-sm"
      />

      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-[0_30px_80px_rgba(0,0,0,.45)]"
      >
        {dismissible && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="absolute right-3 top-3 z-20 flex size-8 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)]"
          >
            <X className="size-4" />
          </button>
        )}

        <div className="px-6 pb-6 pt-8 text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-[var(--text-primary)]/10">
            <Lock className="size-6 text-[var(--text-primary)]" />
          </div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {description}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3">
            {Object.values(PLANS).map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedPlan(p.id)}
                className={`relative rounded-xl p-4 text-left transition-all ${
                  selectedPlan === p.id
                    ? "border-2 border-[var(--accent-mint)]"
                    : "border border-[var(--border)]"
                }`}
                style={{ background: selectedPlan === p.id ? "var(--hover-overlay)" : "transparent" }}
              >
                {p.id === "annual" && (
                  <span className="absolute -top-2 right-2 rounded-full bg-[var(--accent-mint)] px-2 py-0.5 text-[9px] font-[600] uppercase tracking-[0.08em] text-white">
                    {p.discountText}
                  </span>
                )}
                <div className="text-[13px] font-[600] text-[var(--text-primary)]">{p.label}</div>
                <div className="mt-1 flex items-baseline gap-0.5">
                  <span className="text-[20px] font-[700] tracking-[-0.8px] text-[var(--text-primary)]">
                    {p.priceFormatted}
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)]">{p.period}</span>
                </div>
                {p.id === "annual" && (
                  <div className="text-[11px] font-[500] text-[var(--accent-mint)] mt-0.5">
                    R$ {p.monthlyEquivalent}/mês
                  </div>
                )}
              </button>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-2 rounded-lg border border-[var(--border)] p-1">
            <button
              type="button"
              onClick={() => setPaymentMethod("PIX")}
              aria-pressed={paymentMethod === "PIX"}
              className={`flex h-10 items-center justify-center gap-2 rounded-md text-sm transition-colors ${
                paymentMethod === "PIX"
                  ? "bg-[var(--text-primary)] text-[var(--bg-card)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)]"
              }`}
            >
              <QrCode className="size-4" />
              PIX
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod("CARD")}
              aria-pressed={paymentMethod === "CARD"}
              className={`flex h-10 items-center justify-center gap-2 rounded-md text-sm transition-colors ${
                paymentMethod === "CARD"
                  ? "bg-[var(--text-primary)] text-[var(--bg-card)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)]"
              }`}
            >
              <CreditCard className="size-4" />
              Cartao
            </button>
          </div>
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            {paymentMethod === "PIX"
              ? "Pagamento unico com renovacao manual."
              : "Assinatura com renovacao automatica."}
          </p>

          <ul className="mt-5 space-y-2.5 text-left">
            {benefits.map((b) => (
              <li key={b} className="flex items-center gap-2.5 text-sm text-[var(--text-secondary)]">
                <Check className="size-4 shrink-0 text-[var(--accent-mint)]" strokeWidth={2.5} />
                {b}
              </li>
            ))}
          </ul>

          <button
            onClick={() => assinar(selectedPlan)}
            disabled={creating !== null}
            className="mt-6 w-full rounded-full bg-[var(--text-primary)] px-5 py-3 text-sm font-medium text-[var(--bg-card)] transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                Redirecionando...
              </span>
            ) : (
              `Assinar ${plan.label} — ${plan.priceFormatted}${plan.period}`
            )}
          </button>

          {error && (
            <p className="mt-3 text-xs text-red-400">{error}</p>
          )}

          <p className="mt-3 text-xs text-[var(--text-muted)]">
            Pagamento via PIX ou cartão no checkout da AbacatePay, com confirmação automática.
          </p>
        </div>
      </div>
    </div>
  );
}
