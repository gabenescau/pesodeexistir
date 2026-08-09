import { useState } from "react";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/app/data/AuthContext";
import { useData } from "@/app/data/DataContext";
import { getCurrentSubscription, isActiveSubscription } from "@/lib/subscription";
import { PLANS } from "@/lib/plans";
import { PlanBenefitList } from "@/components/plan-benefit";
import { toast } from "@/lib/toast";
import { useCancelSurvey } from "@/components/ui/cancel-survey";

export function SubscribePage() {
  const { user, isAdmin } = useAuth();
  const { subscription, cancelSubscription } = useData();
  const navigate = useNavigate();
  const location = useLocation();
  const cancelSurvey = useCancelSurvey();
  const [loading, setLoading] = useState(true);
  const [cancelError, setCancelError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("monthly");
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const isAppPlansRoute = location.pathname.startsWith("/app/planos");
  const visibleSubscription = currentSubscription || subscription;
  const hasActivePlan = isAdmin || isActiveSubscription(visibleSubscription);
  const hasActiveSubscription = isActiveSubscription(visibleSubscription);

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

  function handleSubscribe() {
    navigate("/app/planos");
  }

  async function handleCancel() {
    if (!visibleSubscription || cancelling) return;
    const resultado = await cancelSurvey.perguntar();
    if (!resultado?.confirmado) return;
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
                    <span className="line-through">R$ {plan.monthlyEquivalent * 2}.00/mês</span>
                    <span className="ml-1.5">cobrados uma vez por ano — R$ {plan.monthlyEquivalent * 12}.00</span>
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
                    handleSubscribe();
                  }}
                  disabled={hasActiveSubscription && isCurrent}
                  className={`mt-6 w-full py-3 rounded-[100px] text-[14px] font-[500] leading-[20px] transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    isSelected
                      ? "bg-[var(--text-primary)] text-[var(--bg-card)] hover:opacity-90"
                      : "border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--hover-overlay)]"
                  }`}
                >
                  {hasActiveSubscription && isCurrent
                    ? "Plano atual"
                    : `Assinar ${plan.label}`}
                </button>
              </div>
            );
          })}
        </div>
      </div>
      {cancelSurvey.dialog}
    </div>
  );
}
