import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/app/data/AuthContext";
import { getCurrentSubscription, isActiveSubscription } from "@/lib/subscription";
import { createCheckout, PLANS } from "@/lib/abacatepay";
import { useEffect } from "react";
import { Check, Loader2 } from "lucide-react";

export function SubscribePage() {
  const { user, isAdmin, profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(null);
  const [error, setError] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState("monthly");

  useEffect(() => {
    if (!user) {
      navigate("/entrar");
      return;
    }

    if (isAdmin) {
      navigate("/app/inicio");
      return;
    }

    getCurrentSubscription(user.id).then((sub) => {
      if (isActiveSubscription(sub)) {
        navigate("/app/inicio");
      }
      setLoading(false);
    });
  }, [user, isAdmin, navigate]);

  async function handleSubscribe(plan) {
    if (!user) return;
    setError(null);
    setCreating(plan);

    try {
      const data = await createCheckout({
        plan,
        name: profile?.name || user.email?.split("@")[0] || "",
      });

      window.location.assign(data.url);
    } catch (e) {
      setError(e.message);
      setCreating(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="size-6 border-2 border-[var(--border)] border-t-[var(--text-primary)] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12" style={{ background: "var(--bg-page)" }}>
      <div className="max-w-4xl w-full space-y-8">
        <div className="text-center">
          <h1 className="text-[32px] font-[600] leading-[40px] tracking-[-1.28px] text-[var(--text-primary)]">
            Escolha seu plano
          </h1>
          <p className="text-[16px] mt-2" style={{ color: "var(--text-muted)" }}>
            Assine o OPE Club e tenha acesso completo à biblioteca e comunidade
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
          {Object.values(PLANS).map((plan) => {
            const isSelected = selectedPlan === plan.id;
            const isAnnual = plan.id === "annual";

            return (
              <button
                key={plan.id}
                onClick={() => setSelectedPlan(plan.id)}
                className={`relative text-left w-full rounded-[16px] p-8 transition-all ${
                  isSelected
                    ? "border-2 border-[var(--accent-mint)] shadow-[0_0_0_1px_var(--accent-mint)]"
                    : "border border-[var(--border)]"
                }`}
                style={{
                  background: "var(--bg-card)",
                  boxShadow: isSelected ? "var(--shadow-md)" : undefined,
                }}
              >
                {isAnnual && (
                  <span className="absolute -top-3 right-6 rounded-full bg-[var(--accent-mint)] px-3 py-1 text-[11px] font-[600] uppercase tracking-[0.1em] text-white">
                    {plan.discountText}
                  </span>
                )}

                <div className="text-[20px] font-[600] tracking-[-0.8px] text-[var(--text-primary)]">
                  {plan.label}
                </div>
                <p className="text-[13px] mt-1" style={{ color: "var(--text-muted)" }}>
                  {plan.description}
                </p>

                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-[36px] font-[700] tracking-[-1.44px] text-[var(--text-primary)]">
                    {plan.priceFormatted}
                  </span>
                  <span className="text-[14px]" style={{ color: "var(--text-muted)" }}>
                    {plan.period}
                  </span>
                </div>

                {isAnnual && (
                  <p className="text-[13px] mt-1 font-[500]" style={{ color: "var(--accent-mint)" }}>
                    Apenas R$ {plan.monthlyEquivalent}/mês
                  </p>
                )}

                <ul className="mt-6 space-y-2.5">
                  {[
                    "Acesso completo à biblioteca",
                    "Comunidade exclusiva",
                    "Grupos de leitura",
                    "Leitura offline",
                    "Sem anúncios",
                    ...(isAnnual ? ["Melhor custo-benefício"] : []),
                  ].map((f) => (
                    <li key={f} className="flex items-center gap-2 text-[13px]" style={{ color: "var(--text-secondary)" }}>
                      <Check className="size-3.5 shrink-0 text-[var(--accent-mint)]" strokeWidth={2.5} />
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSubscribe(plan.id);
                  }}
                  disabled={creating !== null}
                  className={`mt-6 w-full py-3 rounded-[100px] text-[14px] font-[500] leading-[20px] transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    isSelected
                      ? "bg-[var(--text-primary)] text-[var(--bg-card)] hover:opacity-90"
                      : "border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--hover-overlay)]"
                  }`}
                >
                  {creating === plan.id ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="size-4 animate-spin" />
                      Redirecionando...
                    </span>
                  ) : (
                    `Assinar ${plan.label}`
                  )}
                </button>
              </button>
            );
          })}
        </div>

        {error && (
          <p className="text-sm text-red-400 text-center max-w-md mx-auto">{error}</p>
        )}

        <p className="text-xs text-center max-w-md mx-auto" style={{ color: "var(--text-muted)" }}>
          Pagamento 100% seguro via AbacatePay. Aceitamos cartao e PIX.
          Acesso liberado apos a confirmacao do pagamento.
        </p>
      </div>
    </div>
  );
}
