import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, CreditCard, Crown } from "@/lib/icons";
import { SettingsLayout, SettingsRow, SettingsSection } from "../../components/SettingsLayout";
import { useAuth } from "../../data/AuthContext";
import { useData } from "../../data/DataContext";
import { useCancelSurvey } from "@/components/ui/cancel-survey";
import { PlanBenefitList } from "@/components/plan-benefit";
import { PLANS } from "@/lib/abacatepay";
import { isActiveSubscription } from "@/lib/subscription";

const statusLabels = {
  active: { text: "Ativo", color: "var(--accent-mint)" },
  past_due: { text: "Pagamento pendente", color: "#f59e0b" },
  canceled: { text: "Cancelado", color: "var(--text-muted)" },
  expired: { text: "Expirado", color: "var(--text-muted)" },
  pending: { text: "Pendente", color: "#f59e0b" },
  refunded: { text: "Reembolsado", color: "var(--text-muted)" },
  chargeback: { text: "Contestado", color: "#ef4444" },
};

function planBenefits(subscription) {
  if (subscription?.plan === "ope_club_annual") return PLANS.annual.benefits;
  if (subscription?.plan === "ope_club_monthly") return PLANS.monthly.benefits;
  return PLANS.annual.benefits;
}

function planPriceLabel(subscription) {
  if (subscription?.plan === "ope_club_annual") return `${PLANS.annual.priceFormatted},00 / ano`;
  if (subscription?.plan === "ope_club_monthly") return `${PLANS.monthly.priceFormatted},00 / mes`;
  return "—";
}

export function SettingsSubscription() {
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const { isAdmin } = useAuth();
  const { subscription, cancelSubscription } = useData();
  const cancelSurvey = useCancelSurvey();
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");

  const active = isActiveSubscription(subscription);
  const statusInfo = statusLabels[subscription?.status] || { text: "Desconhecido", color: "var(--text-muted)" };
  const benefits = planBenefits(subscription);
  const price = planPriceLabel(subscription);

  async function handleCancel() {
    if (!subscription || cancelling) return;
    const resultado = await cancelSurvey.perguntar();
    if (!resultado?.confirmado) return;
    setCancelling(true);
    setCancelError("");
    try {
      await cancelSubscription(subscription.id);
    } catch (err) {
      setCancelError(err?.message || "Nao foi possivel cancelar a assinatura.");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <SettingsLayout
      title="Assinatura"
      subtitle="Seu plano no OPE Club"
      onBack={() => setSearchParams({})}
    >
      <SettingsSection icon={CreditCard} label="Plano atual">
        <div className="flex items-start justify-between gap-3 px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Crown className="size-4 text-amber-500" weight="fill" />
              <p className="text-base font-semibold text-[var(--text-primary)]">OPE Club</p>
            </div>
            <p className="mt-1 text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
              {active ? price : "Sem assinatura ativa"}
            </p>
            {subscription?.current_period_end ? (
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Valido ate {new Date(subscription.current_period_end).toLocaleDateString("pt-BR")}
              </p>
            ) : null}
          </div>
          {subscription ? (
            <span
              className="shrink-0 rounded-md px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide"
              style={{ color: statusInfo.color, background: `${statusInfo.color}15` }}
            >
              {statusInfo.text}
            </span>
          ) : null}
        </div>

        {!active && !isAdmin ? (
          <div className="mx-4 mb-4 flex items-start gap-3 rounded-[10px] bg-[var(--hover-overlay)] p-3 sm:mx-5">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-[var(--text-muted)]" />
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">Voce ainda nao tem uma assinatura</p>
              <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">Assine para acessar a biblioteca completa e a comunidade.</p>
            </div>
          </div>
        ) : null}

        {(active || isAdmin) && (
          <div className="border-t border-[var(--border)] px-4 py-3 sm:px-5">
            <PlanBenefitList
              benefits={benefits}
              separator={subscription?.plan === "ope_club_annual"}
              itemClassName="flex items-center gap-3 text-sm text-[var(--text-secondary)]"
              iconClassName="size-4 shrink-0 text-[var(--accent-mint)]"
            />
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-t border-[var(--border)] px-4 py-4 sm:px-5">
          {active ? (
            <>
              {subscription?.provider === "abacatepay" ? (
                <button onClick={() => navigate("/app/planos")} className="rounded-full bg-[var(--text-primary)] px-4 py-2 text-sm font-medium text-[var(--bg-card)]">
                  Alterar plano
                </button>
              ) : null}
              <button onClick={handleCancel} disabled={cancelling} className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] hover:border-[var(--border-strong)] disabled:opacity-50">
                {cancelling ? "Cancelando..." : "Cancelar assinatura"}
              </button>
            </>
          ) : isAdmin ? (
            <button onClick={() => navigate("/app/admin")} className="rounded-full bg-[var(--text-primary)] px-4 py-2 text-sm font-medium text-[var(--bg-card)]">
              Abrir painel admin
            </button>
          ) : (
            <button onClick={() => navigate("/app/planos")} className="rounded-full bg-[var(--text-primary)] px-4 py-2 text-sm font-medium text-[var(--bg-card)]">
              Assinar agora
            </button>
          )}
        </div>
        {cancelError ? <p className="px-4 pb-4 text-xs text-red-400 sm:px-5">{cancelError}</p> : null}
        {active && subscription?.provider === "abacatepay" ? (
          <p className="px-4 pb-4 text-[11px] text-[var(--text-muted)] sm:px-5">
            O cancelamento na AbacatePay e imediato, irreversivel e impede novas cobrancas.
          </p>
        ) : null}
      </SettingsSection>

      {subscription?.metadata?.pending_plan ? (
        <SettingsSection label="Mudanca agendada">
          <SettingsRow
            title="Novo plano"
            description={`Ativa no proximo ciclo: ${subscription.metadata.pending_plan === "ope_club_annual" ? "anual" : "mensal"}`}
          />
        </SettingsSection>
      ) : null}

      {cancelSurvey.dialog}
    </SettingsLayout>
  );
}
