import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/app/data/AuthContext";
import { useData } from "@/app/data/DataContext";
import { getCurrentSubscription, isActiveSubscription } from "@/lib/subscription";
import { createCheckout, PLANS } from "@/lib/abacatepay";
import { useEffect } from "react";
import { CreditCard, Loader2, QrCode } from "@/lib/icons";
import { PlanBenefitList } from "@/components/plan-benefit";
import { toast } from "@/lib/toast";

export function SubscribePage() {
  const { user, isAdmin } = useAuth();
  const { subscription, cancelSubscription, changeSubscriptionPlan } = useData();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(null);
  const [error, setError] = useState(null);
  const [cancelError, setCancelError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("monthly");
  const [paymentMethod, setPaymentMethod] = useState("PIX");
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const isAppPlansRoute = location.pathname.startsWith("/app/planos");
  const visibleSubscription = currentSubscription || subscription;
  const hasActivePlan = isAdmin || isActiveSubscription(visibleSubscription);
  const hasActiveSubscription = isActiveSubscription(visibleSubscription);
  const isOneTimePlan = visibleSubscription?.metadata?.billing_mode === "one_time";

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
      if (isActiveSubscription(visibleSubscription)) {
        if (visibleSubscription.provider !== "abacatepay") {
          throw new Error("Planos concedidos manualmente devem ser alterados pelo administrador.");
        }
        const updated = await changeSubscriptionPlan(visibleSubscription.id, plan);
        setCurrentSubscription(updated);
        setCreating(null);
        toast.success("Plano atualizado. A alteracao sera aplicada no proximo ciclo.");
        return;
      }

      const data = await createCheckout({
        plan,
        paymentMethod,
      });

      window.location.assign(data.url);
    } catch (e) {
      setError(e.message);
      toast.error(e.message);
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
      toast.success("Assinatura cancelada. O acesso continua ate o fim do ciclo.");
    } catch (e) {
      const message = e?.message || "Nao foi possivel cancelar a assinatura.";
      setCancelError(message);
      toast.error(message);
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
          {hasActivePlan && !isAdmin && (
            <p className="mx-auto mt-4 max-w-xl rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3 text-sm" style={{ color: "var(--text-secondary)" }}>
              "Voce ja tem um plano ativo. Esta tela fica disponivel para consultar ou renovar seu acesso."
            </p>
          )}
        </div>

        {!isAdmin && (hasActivePlan || visibleSubscription) && (
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

        {!hasActiveSubscription && (
          <div className="mx-auto grid w-full max-w-md grid-cols-2 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-1">
            <button
              type="button"
              onClick={() => setPaymentMethod("PIX")}
              aria-pressed={paymentMethod === "PIX"}
              className={`flex h-11 items-center justify-center gap-2 rounded-md text-sm transition-colors ${
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
              className={`flex h-11 items-center justify-center gap-2 rounded-md text-sm transition-colors ${
                paymentMethod === "CARD"
                  ? "bg-[var(--text-primary)] text-[var(--bg-card)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)]"
              }`}
            >
              <CreditCard className="size-4" />
              Cartao
            </button>
          </div>
        )}

        {!hasActiveSubscription && (
          <p className="-mt-5 text-center text-xs text-[var(--text-muted)]">
            {paymentMethod === "PIX"
              ? "Pagamento unico. Renove manualmente ao fim do periodo."
              : "Assinatura recorrente com renovacao automatica."}
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
          {Object.values(PLANS).map((plan) => {
            const isSelected = selectedPlan === plan.id;
            const isAnnual = plan.id === "annual";
            const isCurrent = visibleSubscription?.plan === (
              plan.id === "annual" ? "ope_club_annual" : "ope_club_monthly"
            );

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
                    {isAnnual ? `R$ ${plan.monthlyEquivalent}` : plan.priceFormatted}
                  </span>
                  <span className="text-[14px]" style={{ color: "var(--text-muted)" }}>
                    /mês
                  </span>
                </div>

                {isAnnual ? (
                  <p className="text-[13px] mt-1 font-[500]" style={{ color: "var(--text-muted)" }}>
                    <span className="line-through">R$ {plan.monthlyEquivalent * 2}.00</span>
                    <span className="ml-1.5">cobrados uma vez por ano ({plan.priceFormatted})</span>
                  </p>
                ) : (
                  <p className="text-[13px] mt-1 font-[500]" style={{ color: "var(--text-muted)" }}>
                    Cobrança mensal · cancele quando quiser
                  </p>
                )}

                <ul className="mt-6 space-y-2.5">
                  <PlanBenefitList
                    benefits={plan.benefits}
                    separator={isAnnual}
                    itemClassName="flex items-center gap-2 text-[13px] text-[var(--text-secondary)]"
                    iconClassName="size-3.5 shrink-0 text-[var(--accent-mint)]"
                  />
                </ul>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSubscribe(plan.id);
                  }}
                  disabled={creating !== null || (hasActiveSubscription && (isCurrent || isOneTimePlan))}
                  className={`mt-6 w-full py-3 rounded-[100px] text-[14px] font-[500] leading-[20px] transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    isSelected
                      ? "bg-[var(--text-primary)] text-[var(--bg-card)] hover:opacity-90"
                      : "border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--hover-overlay)]"
                  }`}
                >
                  {creating === plan.id ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="size-4 animate-spin" />
                      {hasActiveSubscription ? "Agendando..." : "Redirecionando..."}
                    </span>
                  ) : hasActiveSubscription && isCurrent ? (
                    "Plano atual"
                  ) : hasActiveSubscription && isOneTimePlan ? (
                    "Disponivel na renovacao"
                  ) : hasActiveSubscription ? (
                    plan.id === "annual" ? "Fazer upgrade" : "Fazer downgrade"
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
        {visibleSubscription?.metadata?.pending_plan && (
          <p className="text-sm text-center text-[var(--accent-mint)]">
            Alteracao para o plano {visibleSubscription.metadata.pending_plan === "ope_club_annual" ? "anual" : "mensal"} agendada para o proximo ciclo.
          </p>
        )}

        <p className="text-xs text-center max-w-md mx-auto" style={{ color: "var(--text-muted)" }}>
          Pagamento 100% seguro via PIX ou cartão no checkout da AbacatePay.
          Acesso liberado apos a confirmacao do pagamento.
        </p>
      </div>
    </div>
  );
}
