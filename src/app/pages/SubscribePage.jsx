import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/app/data/AuthContext";
import { useData } from "@/app/data/DataContext";
import { getCurrentSubscription, isActiveSubscription } from "@/lib/subscription";
import { createCheckout, PLANS } from "@/lib/abacatepay";
import { useEffect } from "react";
import { Check, Loader2 } from "lucide-react";

export function SubscribePage() {
  const { user, isAdmin, profile } = useAuth();
  const { subscription, cancelSubscription } = useData();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(null);
  const [error, setError] = useState(null);
  const [cancelError, setCancelError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("monthly");
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const isAppPlansRoute = location.pathname.startsWith("/app/planos");
  const visibleSubscription = currentSubscription || subscription;
  const hasActivePlan = isAdmin || isActiveSubscription(visibleSubscription);

  useEffect(() => {
    if (!user) {
      navigate("/entrar");
      return;
    }

    if (isAdmin && !isAppPlansRoute) {
      navigate("/app/inicio");
      return;
    }

    getCurrentSubscription(user.id).then((sub) => {
      setCurrentSubscription(sub);
      if (!isAppPlansRoute && isActiveSubscription(sub)) {
        navigate("/app/inicio");
        return;
      }
      setLoading(false);
    });
  }, [user, isAdmin, isAppPlansRoute, navigate]);

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

  async function handleCancel() {
    if (!visibleSubscription || cancelling) return;
    setCancelling(true);
    setCancelError("");
    try {
      const updated = await cancelSubscription(visibleSubscription.id);
      setCurrentSubscription(updated || { ...visibleSubscription, status: "canceled" });
    } catch (e) {
      setCancelError(e?.message || "Nao foi possivel cancelar a assinatura.");
    } finally {
      setCancelling(false);
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
          {hasActivePlan && (
            <p className="mx-auto mt-4 max-w-xl rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3 text-sm" style={{ color: "var(--text-secondary)" }}>
              {isAdmin
                ? "Sua conta tem acesso administrativo. Os planos continuam visiveis para revisao."
                : "Voce ja tem um plano ativo. Esta tela fica disponivel para consultar ou renovar seu acesso."}
            </p>
          )}
        </div>

        {(hasActivePlan || visibleSubscription) && (
          <div className="mx-auto max-w-2xl rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-sm)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">Plano atual</p>
                <h2 className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
                  {isAdmin ? "Acesso administrativo" : visibleSubscription?.plan === "ope_club_annual" ? "OPE Club Anual" : "OPE Club Mensal"}
                </h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  {isAdmin
                    ? "Admins podem revisar os planos e gerenciar usuarios pelo painel."
                    : visibleSubscription?.current_period_end
                      ? `Valido ate ${new Date(visibleSubscription.current_period_end).toLocaleDateString("pt-BR")}`
                      : "Assinatura vinculada a sua conta."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => navigate("/app/configuracoes")}
                  className="rounded-full border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--hover-overlay)]"
                >
                  Configuracoes
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => navigate("/app/admin")}
                    className="rounded-full bg-[var(--text-primary)] px-4 py-2 text-sm font-medium text-[var(--bg-card)] transition-opacity hover:opacity-90"
                  >
                    Painel admin
                  </button>
                )}
                {!isAdmin && isActiveSubscription(visibleSubscription) && (
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={cancelling}
                    className="rounded-full border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-primary)] transition-colors hover:border-[var(--border-strong)] disabled:opacity-50"
                  >
                    {cancelling ? "Cancelando..." : "Cancelar assinatura"}
                  </button>
                )}
              </div>
            </div>
            {cancelError && <p className="mt-3 text-xs text-red-400">{cancelError}</p>}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
          {Object.values(PLANS).map((plan) => {
            const isSelected = selectedPlan === plan.id;
            const isAnnual = plan.id === "annual";

            return (
              <div
                key={plan.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedPlan(plan.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedPlan(plan.id);
                  }
                }}
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
              </div>
            );
          })}
        </div>

        {error && (
          <p className="text-sm text-red-400 text-center max-w-md mx-auto">{error}</p>
        )}

        <p className="text-xs text-center max-w-md mx-auto" style={{ color: "var(--text-muted)" }}>
          Pagamento 100% seguro via PIX ou cartão no checkout da AbacatePay.
          Acesso liberado apos a confirmacao do pagamento.
        </p>
      </div>
    </div>
  );
}
