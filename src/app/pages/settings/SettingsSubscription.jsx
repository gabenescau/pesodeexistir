import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, CreditCard, Crown, Loader2, QrCode } from "@/lib/icons";
import { SettingsLayout, SettingsRow, SettingsSection } from "../../components/SettingsLayout";
import { useAuth } from "../../data/AuthContext";
import { useData } from "../../data/DataContext";
import { useCancelSurvey } from "@/components/ui/cancel-survey";
import { PlanBenefitList } from "@/components/plan-benefit";
import { authenticatedApiPost } from "@/lib/authenticated-api";
import { planInfoFromCode, planPriceLabel } from "@/lib/plans";
import { isActiveSubscription } from "@/lib/subscription";
import { toast } from "@/lib/toast";

const STATUS_LABELS = {
  active: { text: "Ativo", color: "var(--accent-mint)" },
  trialing: { text: "Periodo de teste", color: "var(--accent-mint)" },
  past_due: { text: "Pagamento pendente", color: "#f59e0b" },
  paused: { text: "Pausado", color: "#f59e0b" },
  canceled: { text: "Cancelado", color: "var(--text-muted)" },
  expired: { text: "Expirado", color: "var(--text-muted)" },
  pending: { text: "Pendente", color: "#f59e0b" },
  refunded: { text: "Reembolsado", color: "var(--text-muted)" },
};

export function SettingsSubscription() {
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const { isAdmin } = useAuth();
  const { subscription, cancelSubscription } = useData();
  const cancelSurvey = useCancelSurvey();
  const [working, setWorking] = useState("");
  const active = isActiveSubscription(subscription);
  const planInfo = planInfoFromCode(subscription?.plan);
  const recurringStripe = subscription?.provider === "stripe" && Boolean(subscription?.provider_subscription_id);
  const pixAccess = subscription?.provider === "stripe" && !subscription?.provider_subscription_id;
  const statusInfo = STATUS_LABELS[subscription?.status] || { text: "Desconhecido", color: "var(--text-muted)" };

  async function handleCancel() {
    if (!subscription || working) return;
    const answer = await cancelSurvey.perguntar();
    if (!answer?.confirmado) return;
    setWorking("cancel");
    try {
      await cancelSubscription(subscription.id);
      toast.success("Renovacao cancelada. O acesso continua ate o fim do ciclo.");
    } catch (error) {
      toast.error(error?.message || "Nao foi possivel cancelar a assinatura.");
    } finally {
      setWorking("");
    }
  }

  async function openPortal() {
    if (!subscription || working) return;
    setWorking("portal");
    try {
      const result = await authenticatedApiPost("/api/stripe-portal", { subscriptionId: subscription.id });
      window.location.assign(result.url);
    } catch (error) {
      toast.error(error?.message || "Nao foi possivel abrir o portal da Stripe.");
      setWorking("");
    }
  }

  return (
    <SettingsLayout title="Assinatura" subtitle="Seu plano no OPE Club" onBack={() => setSearchParams({})}>
      <SettingsSection icon={CreditCard} label="Plano atual">
        <div className="flex items-start justify-between gap-3 px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Crown className="size-4 text-amber-500" weight="fill" />
              <p className="text-base font-semibold text-[var(--text-primary)]">{planInfo?.tierLabel || (isAdmin ? "Acesso administrativo" : "OPE Club")}</p>
            </div>
            <p className="mt-1 text-[11px] uppercase tracking-wide text-[var(--text-muted)]">{active ? planPriceLabel(subscription?.plan) : "Sem assinatura ativa"}</p>
            {subscription?.current_period_end ? <p className="mt-1 text-xs text-[var(--text-muted)]">Valido ate {new Date(subscription.current_period_end).toLocaleDateString("pt-BR")}</p> : null}
          </div>
          {subscription ? <span className="shrink-0 rounded-md px-2.5 py-1 text-[11px] font-medium uppercase" style={{ color: statusInfo.color, background: `${statusInfo.color}15` }}>{statusInfo.text}</span> : null}
        </div>

        {!active && !isAdmin ? (
          <div className="mx-4 mb-4 flex items-start gap-3 rounded-[8px] bg-[var(--hover-overlay)] p-3 sm:mx-5">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <div><p className="text-sm font-medium text-[var(--text-primary)]">Voce ainda nao tem uma assinatura</p><p className="mt-0.5 text-[11px] text-[var(--text-muted)]">Escolha cartao recorrente ou PIX de pagamento unico.</p></div>
          </div>
        ) : null}

        {active && planInfo ? (
          <div className="border-t border-[var(--border)] px-4 py-3 sm:px-5">
            <PlanBenefitList benefits={planInfo.tierConfig.benefits} separator={planInfo.cycle === "annual"} itemClassName="flex items-start gap-3 text-sm text-[var(--text-secondary)]" iconClassName="mt-0.5 size-4 shrink-0 text-[var(--accent-mint)]" />
          </div>
        ) : null}

        {pixAccess && active ? (
          <div className="mx-4 mb-4 flex items-start gap-3 rounded-[8px] border border-[var(--border)] p-3 sm:mx-5">
            <QrCode className="mt-0.5 size-4 shrink-0" />
            <p className="text-xs leading-5 text-[var(--text-muted)]">Este acesso foi pago uma unica vez por PIX. Nao existe renovacao automatica nem assinatura recorrente para cancelar.</p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 border-t border-[var(--border)] px-4 py-4 sm:px-5">
          {active ? <button type="button" onClick={() => navigate("/app/planos")} className="min-h-11 rounded-[8px] bg-[var(--text-primary)] px-4 text-sm font-medium text-[var(--bg-card)]">Ver ou alterar plano</button> : isAdmin ? <button type="button" onClick={() => navigate("/app/admin")} className="min-h-11 rounded-[8px] bg-[var(--text-primary)] px-4 text-sm font-medium text-[var(--bg-card)]">Abrir painel admin</button> : <button type="button" onClick={() => navigate("/app/planos")} className="min-h-11 rounded-[8px] bg-[var(--text-primary)] px-4 text-sm font-medium text-[var(--bg-card)]">Assinar agora</button>}
          {active && recurringStripe ? <button type="button" onClick={openPortal} disabled={Boolean(working)} className="flex min-h-11 items-center gap-2 rounded-[8px] border border-[var(--border)] px-4 text-sm text-[var(--text-primary)] disabled:opacity-50">{working === "portal" ? <Loader2 className="size-4 animate-spin" /> : null}Pagamentos e faturas</button> : null}
          {active && recurringStripe && !subscription.cancel_at_period_end ? <button type="button" onClick={handleCancel} disabled={Boolean(working)} className="min-h-11 rounded-[8px] border border-[var(--border)] px-4 text-sm text-red-400 disabled:opacity-50">{working === "cancel" ? "Cancelando..." : "Cancelar renovacao"}</button> : null}
        </div>
      </SettingsSection>

      {subscription?.metadata?.requested_plan ? (
        <SettingsSection label="Mudanca solicitada"><SettingsRow title="Novo plano" description="A mudanca sera aplicada quando a Stripe confirmar a cobranca proporcional." /></SettingsSection>
      ) : null}
      {cancelSurvey.dialog}
    </SettingsLayout>
  );
}
