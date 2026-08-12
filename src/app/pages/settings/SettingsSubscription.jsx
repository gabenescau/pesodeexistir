import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowUpRight,
  CalendarDays,
  CheckCircle,
  CreditCard,
  Crown,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "@/lib/icons";
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
  const [managedSubscription, setManagedSubscription] = useState(subscription);

  useEffect(() => {
    setManagedSubscription(subscription);
  }, [subscription]);

  useEffect(() => {
    if (!subscription || subscription.provider !== "stripe") return undefined;
    let cancelled = false;
    authenticatedApiPost("/api/stripe-portal", { mode: "sync" })
      .then((result) => {
        if (!cancelled && result?.subscription) setManagedSubscription(result.subscription);
      })
      .catch(() => {
        // The webhook remains the source of truth if a foreground sync is unavailable.
      });
    return () => { cancelled = true; };
  }, [subscription?.id, subscription?.provider]);

  const active = isActiveSubscription(managedSubscription);
  const planInfo = planInfoFromCode(managedSubscription?.plan);
  const recurringStripe = managedSubscription?.provider === "stripe" && Boolean(managedSubscription?.provider_subscription_id);
  const statusInfo = STATUS_LABELS[managedSubscription?.status] || { text: "Desconhecido", color: "var(--text-muted)" };
  const cancelScheduled = active && Boolean(managedSubscription?.cancel_at_period_end);
  const periodEnd = useMemo(() => {
    if (!managedSubscription?.current_period_end) return null;
    return new Date(managedSubscription.current_period_end).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }, [managedSubscription?.current_period_end]);

  async function handleCancel() {
    if (!managedSubscription || working) return;
    const answer = await cancelSurvey.perguntar();
    if (!answer?.confirmado) return;
    setWorking("cancel");
    try {
      const updated = await cancelSubscription(managedSubscription.id);
      setManagedSubscription(updated || { ...managedSubscription, cancel_at_period_end: true });
      toast.success("Renovacao cancelada. O acesso continua ate o fim do ciclo.");
    } catch (error) {
      toast.error(error?.message || "Nao foi possivel cancelar a assinatura.");
    } finally {
      setWorking("");
    }
  }

  async function handleResume() {
    if (!managedSubscription || working) return;
    setWorking("resume");
    try {
      const updated = await authenticatedApiPost("/api/cancel-subscription", {
        subscriptionId: managedSubscription.id,
        resume: true,
      });
      setManagedSubscription(updated);
      toast.success("Renovacao reativada. Seu plano continuara ativo.");
    } catch (error) {
      toast.error(error?.message || "Nao foi possivel reativar a renovacao.");
    } finally {
      setWorking("");
    }
  }

  async function openPortal() {
    if (!managedSubscription || working) return;
    setWorking("portal");
    try {
      const result = await authenticatedApiPost("/api/stripe-portal", { subscriptionId: managedSubscription.id });
      window.location.assign(result.url);
    } catch (error) {
      toast.error(error?.message || "Nao foi possivel abrir o portal da Stripe.");
      setWorking("");
    }
  }

  return (
    <SettingsLayout title="Assinatura" subtitle="Seu plano no OPE Club" onBack={() => setSearchParams({})}>
      <SettingsSection icon={CreditCard} label="Plano atual">
        <div className="flex flex-col gap-4 px-4 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Crown className="size-4 text-amber-500" weight="fill" />
              <p className="text-base font-semibold text-[var(--text-primary)]">{planInfo?.tierLabel || (isAdmin ? "Acesso administrativo" : "OPE Club")}</p>
            </div>
            <p className="mt-1 text-[11px] uppercase tracking-wide text-[var(--text-muted)]">{active ? planPriceLabel(managedSubscription?.plan) : "Sem assinatura ativa"}</p>
            {periodEnd ? (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                <CalendarDays className="size-3.5" />
                {cancelScheduled ? `Acesso ate ${periodEnd}` : `Proxima cobranca em ${periodEnd}`}
              </p>
            ) : null}
          </div>
          {managedSubscription ? <span className="self-start rounded-full px-2.5 py-1 text-[11px] font-medium uppercase" style={{ color: statusInfo.color, background: `${statusInfo.color}15` }}>{statusInfo.text}</span> : null}
        </div>

        {!active && !isAdmin ? (
          <div className="mx-4 mb-4 flex items-start gap-3 rounded-[8px] bg-[var(--hover-overlay)] p-3 sm:mx-5">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <div><p className="text-sm font-medium text-[var(--text-primary)]">Voce ainda nao tem uma assinatura</p><p className="mt-0.5 text-[11px] text-[var(--text-muted)]">Escolha um plano para ativar seu acesso recorrente.</p></div>
          </div>
        ) : null}

        {active && planInfo ? (
          <div className="border-t border-[var(--border)] px-4 py-3 sm:px-5">
            <PlanBenefitList benefits={planInfo.tierConfig.benefits} separator={planInfo.cycle === "annual"} itemClassName="flex items-start gap-3 text-sm text-[var(--text-secondary)]" iconClassName="mt-0.5 size-4 shrink-0 text-[var(--accent-mint)]" />
          </div>
        ) : null}

        <div className="flex flex-col gap-2 border-t border-[var(--border)] px-4 py-4 sm:flex-row sm:flex-wrap sm:px-5">
          {active ? <button type="button" onClick={() => navigate("/app/planos")} className="flex min-h-11 items-center justify-center gap-2 rounded-[9px] bg-[var(--text-primary)] px-4 text-sm font-medium text-[var(--bg-card)] transition-opacity hover:opacity-90"><ArrowUpRight className="size-4" />Alterar plano</button> : isAdmin ? <button type="button" onClick={() => navigate("/app/admin")} className="min-h-11 rounded-[9px] bg-[var(--text-primary)] px-4 text-sm font-medium text-[var(--bg-card)]">Abrir painel admin</button> : <button type="button" onClick={() => navigate("/app/planos")} className="min-h-11 rounded-[9px] bg-[var(--text-primary)] px-4 text-sm font-medium text-[var(--bg-card)]">Assinar agora</button>}
          {active && recurringStripe ? <button type="button" onClick={openPortal} disabled={Boolean(working)} className="flex min-h-11 items-center justify-center gap-2 rounded-[9px] border border-[var(--border)] px-4 text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--hover-overlay)] disabled:opacity-50">{working === "portal" ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}Faturas e pagamento</button> : null}
          {active && recurringStripe && cancelScheduled ? <button type="button" onClick={handleResume} disabled={Boolean(working)} className="flex min-h-11 items-center justify-center gap-2 rounded-[9px] border border-[var(--accent-mint)]/40 px-4 text-sm text-[var(--accent-mint)] transition-colors hover:bg-[var(--accent-mint)]/10 disabled:opacity-50">{working === "resume" ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}Manter renovacao</button> : null}
          {active && recurringStripe && !cancelScheduled ? <button type="button" onClick={handleCancel} disabled={Boolean(working)} className="min-h-11 rounded-[9px] border border-red-500/30 px-4 text-sm text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50">{working === "cancel" ? "Cancelando..." : "Cancelar renovacao"}</button> : null}
        </div>
      </SettingsSection>

      {active && recurringStripe ? (
        <SettingsSection icon={ShieldCheck} label="Gerenciamento seguro">
          <div className="grid gap-3 p-4 sm:grid-cols-3 sm:p-5">
            <div className="rounded-[10px] border border-[var(--border)] p-3">
              <CheckCircle className="mb-2 size-4 text-[var(--accent-mint)]" />
              <p className="text-xs font-medium text-[var(--text-primary)]">Stripe conectado</p>
              <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-muted)]">A Stripe confirma pagamentos e renovacoes.</p>
            </div>
            <div className="rounded-[10px] border border-[var(--border)] p-3">
              <CalendarDays className="mb-2 size-4 text-[var(--text-secondary)]" />
              <p className="text-xs font-medium text-[var(--text-primary)]">Ciclo transparente</p>
              <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-muted)]">Voce ve quando o acesso muda.</p>
            </div>
            <div className="rounded-[10px] border border-[var(--border)] p-3">
              <RefreshCw className="mb-2 size-4 text-[var(--text-secondary)]" />
              <p className="text-xs font-medium text-[var(--text-primary)]">Controle total</p>
              <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-muted)]">Faturas e forma de pagamento ficam no portal Stripe.</p>
            </div>
          </div>
        </SettingsSection>
      ) : null}

      {managedSubscription?.metadata?.requested_plan ? (
        <SettingsSection label="Mudanca solicitada"><SettingsRow title="Novo plano" description="A mudanca sera aplicada quando a Stripe confirmar a cobranca proporcional." /></SettingsSection>
      ) : null}
      {cancelSurvey.dialog}
    </SettingsLayout>
  );
}
