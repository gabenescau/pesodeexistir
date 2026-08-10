import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/app/data/AuthContext";
import { useData } from "@/app/data/DataContext";
import { authenticatedApiPost } from "@/lib/authenticated-api";
import { CYCLES, TIERS, formatBRL, getTierPlanKey, planInfoFromCode } from "@/lib/plans";
import { getCurrentSubscription, isActiveSubscription } from "@/lib/subscription";
import { PlanBenefitList } from "@/components/plan-benefit";
import { CreditCard, Loader2, QrCode, ShieldCheck } from "@/lib/icons";
import { toast } from "@/lib/toast";
import { useCancelSurvey } from "@/components/ui/cancel-survey";
import { parseCheckoutInput, parseSubscriptionInput } from "@/lib/api-contracts";

const PAYMENT_METHODS = {
  CARD: {
    id: "CARD",
    label: "Cartao",
    description: "Renovacao automatica e gerenciamento pela Stripe",
    icon: CreditCard,
  },
  PIX: {
    id: "PIX",
    label: "PIX",
    description: "Pagamento unico por QR Code, sem renovacao automatica",
    icon: QrCode,
  },
};

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export function SubscribePage() {
  const { user, isAdmin } = useAuth();
  const { subscription, cancelSubscription } = useData();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const checkoutState = searchParams.get("checkout");
  const checkoutSessionId = searchParams.get("session_id");
  const cancelSurvey = useCancelSurvey();
  const requestedTier = searchParams.get("plan");
  const requestedCycle = searchParams.get("ciclo");
  const [tierId, setTierId] = useState(TIERS[requestedTier] ? requestedTier : "pensador");
  const [cycle, setCycle] = useState(CYCLES[requestedCycle] ? requestedCycle : "monthly");
  const [paymentMethod, setPaymentMethod] = useState("CARD");
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [checkoutMessage, setCheckoutMessage] = useState("");

  const visibleSubscription = currentSubscription || subscription;
  const active = isActiveSubscription(visibleSubscription);
  const currentInfo = planInfoFromCode(visibleSubscription?.plan);
  const selectedTier = TIERS[tierId];
  const selectedPlanKey = getTierPlanKey(tierId, cycle);
  const selectedPrice = cycle === "annual" ? selectedTier.annualPrice : selectedTier.monthlyPrice;
  const isCurrentPlan = active && currentInfo?.tier === tierId && currentInfo?.cycle === cycle;
  const isRecurringStripe = visibleSubscription?.provider === "stripe" && Boolean(visibleSubscription?.provider_subscription_id);
  const isPixAccess = visibleSubscription?.provider === "stripe" && !visibleSubscription?.provider_subscription_id;
  const canChangePlan = active && isRecurringStripe && !isCurrentPlan;

  const priceCaption = useMemo(() => {
    if (cycle === "annual") {
      return `${formatBRL(selectedPrice)} por ano (${formatBRL(Math.round(selectedPrice / 12))}/mes)`;
    }
    return `${formatBRL(selectedPrice)} por mes`;
  }, [cycle, selectedPrice]);

  useEffect(() => {
    if (!user) {
      navigate("/entrar");
      return;
    }
    let cancelled = false;
    getCurrentSubscription(user.id).then((value) => {
      if (cancelled) return;
      setCurrentSubscription(value);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [navigate, user]);

  useEffect(() => {
    if (checkoutState === "canceled") {
      toast.info("Checkout cancelado. Nenhuma cobranca foi feita.");
      setSearchParams({}, { replace: true });
      return;
    }
    if (checkoutState !== "success" || !checkoutSessionId || !user) return;

    let cancelled = false;
    async function confirmCheckout() {
      setWorking("confirm");
      setCheckoutMessage("Confirmando o pagamento com a Stripe...");
      try {
        for (let attempt = 0; attempt < 12; attempt += 1) {
          const result = await authenticatedApiPost("/api/stripe-session", { sessionId: checkoutSessionId });
          if (result.fulfilled) {
            toast.success("Pagamento confirmado. Seu acesso esta ativo.");
            window.location.replace("/app/inicio?payment=success");
            return;
          }
          if (result.status === "expired") throw new Error("O checkout expirou sem pagamento.");
          if (attempt < 11) await sleep(2500);
          if (cancelled) return;
        }
        setCheckoutMessage("O pagamento ainda esta sendo processado. Esta pagina pode ser atualizada em alguns instantes.");
      } catch (error) {
        if (!cancelled) {
          setCheckoutMessage("");
          toast.error(error?.message || "Nao foi possivel confirmar o pagamento.");
        }
      } finally {
        if (!cancelled) setWorking("");
      }
    }
    confirmCheckout();
    return () => { cancelled = true; };
  }, [checkoutSessionId, checkoutState, setSearchParams, user]);

  async function handlePrimaryAction() {
    if (working || isCurrentPlan) return;
    if (isPixAccess && active) {
      toast.info("Seu PIX concede acesso ate a data exibida. Um novo plano pode ser comprado depois desse periodo.");
      return;
    }

    setWorking("checkout");
    try {
      if (canChangePlan) {
        const changePlanInput = parseSubscriptionInput({
          subscriptionId: visibleSubscription.id,
          plan: selectedPlanKey,
        });
        const result = await authenticatedApiPost("/api/stripe-change-plan", {
          ...changePlanInput,
        });
        toast.success(result.pending
          ? "Alteracao solicitada. O plano muda quando a Stripe confirmar a cobranca."
          : "Plano alterado com sucesso.");
        return;
      }

      const checkoutInput = parseCheckoutInput({
        plan: selectedPlanKey,
        paymentMethod,
        attemptId: window.crypto?.randomUUID?.() || `checkout-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      });
      const result = await authenticatedApiPost("/api/stripe-checkout", checkoutInput);
      if (!result?.url) throw new Error("A Stripe nao retornou o endereco do checkout.");
      window.location.assign(result.url);
    } catch (error) {
      toast.error(error?.message || "Nao foi possivel abrir o checkout.");
    } finally {
      setWorking("");
    }
  }

  async function handleCancel() {
    if (!visibleSubscription || working) return;
    const answer = await cancelSurvey.perguntar();
    if (!answer?.confirmado) return;
    setWorking("cancel");
    try {
      const updated = await cancelSubscription(visibleSubscription.id);
      setCurrentSubscription(updated);
      toast.success("A renovacao foi cancelada. O acesso continua ate o fim do ciclo.");
    } catch (error) {
      toast.error(error?.message || "Nao foi possivel cancelar a assinatura.");
    } finally {
      setWorking("");
    }
  }

  if (loading) {
    return <div className="flex min-h-[50dvh] items-center justify-center"><Loader2 className="size-6 animate-spin" /></div>;
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-3 py-5 sm:px-6 sm:py-8">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--accent-mint)]">OPE Club</p>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--text-primary)] sm:text-3xl">Escolha como voce quer participar</h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--text-muted)]">Planos e valores sao validados no servidor. O pagamento acontece no Checkout seguro da Stripe.</p>
      </header>

      {checkoutMessage ? (
        <div className="mb-5 flex items-start gap-3 rounded-[8px] border border-[var(--border)] bg-[var(--bg-card)] p-4 text-sm text-[var(--text-secondary)]">
          {working === "confirm" ? <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" /> : <ShieldCheck className="mt-0.5 size-4 shrink-0" />}
          {checkoutMessage}
        </div>
      ) : null}

      {(active || isAdmin) && (
        <section className="mb-5 flex flex-col gap-3 border-y border-[var(--border)] py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase text-[var(--text-muted)]">Plano atual</p>
            <p className="mt-1 font-semibold text-[var(--text-primary)]">{isAdmin ? "Acesso administrativo" : currentInfo?.tierLabel || "OPE Club"}</p>
            {!isAdmin && visibleSubscription?.current_period_end ? (
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                {isPixAccess ? "Acesso pago por PIX ate " : visibleSubscription.cancel_at_period_end ? "Renovacao cancelada, acesso ate " : "Proximo ciclo em "}
                {new Date(visibleSubscription.current_period_end).toLocaleDateString("pt-BR")}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => navigate("/app/configuracoes?aba=assinatura")} className="min-h-11 rounded-[8px] border border-[var(--border)] px-4 text-sm text-[var(--text-primary)]">Gerenciar</button>
            {!isAdmin && isRecurringStripe && !visibleSubscription.cancel_at_period_end ? (
              <button type="button" onClick={handleCancel} disabled={Boolean(working)} className="min-h-11 rounded-[8px] border border-[var(--border)] px-4 text-sm text-red-400 disabled:opacity-50">
                {working === "cancel" ? "Cancelando..." : "Cancelar renovacao"}
              </button>
            ) : null}
          </div>
        </section>
      )}

      <section className="mb-5 flex flex-col gap-4 rounded-[8px] border border-[var(--border)] bg-[var(--bg-card)] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5" aria-labelledby="billing-cycle-title">
        <div className="min-w-0">
          <p id="billing-cycle-title" className="text-sm font-semibold text-[var(--text-primary)]">Escolha a frequência</p>
          <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">Altere entre cobrança mensal e anual antes de escolher seu plano.</p>
        </div>
        <div className="grid w-full grid-cols-2 gap-1 rounded-[8px] border border-[var(--border)] bg-[var(--bg)] p-1 sm:w-auto" role="radiogroup" aria-label="Frequência de cobrança">
          {Object.values(CYCLES).map((item) => {
            const selected = cycle === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setCycle(item.id)}
                className={`min-h-11 rounded-[6px] px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-mint)] ${selected ? "bg-[var(--text-primary)] text-[var(--bg-card)] shadow-sm" : "text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)]"}`}
              >
                <span>{item.label}</span>
                {item.id === "annual" ? <span className={`ml-1.5 text-[10px] font-semibold ${selected ? "text-[var(--bg-card)]/75" : "text-[var(--accent-mint)]"}`}>-{selectedTier.annualDiscountPercent}%</span> : null}
              </button>
            );
          })}
        </div>
      </section>

      <div className="mb-5 grid gap-4 sm:grid-cols-2">
        {Object.values(TIERS).map((tier) => {
          const selected = tier.id === tierId;
          return (
            <button
              type="button"
              key={tier.id}
              onClick={() => setTierId(tier.id)}
              aria-pressed={selected}
              className={`min-w-0 rounded-[8px] border p-5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-mint)] ${selected ? "border-[var(--accent-mint)] bg-[var(--hover-overlay)]" : "border-[var(--border)] bg-[var(--bg-card)]"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">{tier.label}</h2>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{tier.description}</p>
                </div>
                {tier.id === "pensador" ? <span className="shrink-0 rounded-full bg-[var(--accent-mint)]/10 px-2 py-1 text-[10px] font-semibold uppercase text-[var(--accent-mint)]">Completo</span> : null}
              </div>
              <p className="mt-4 text-2xl font-semibold text-[var(--text-primary)]">{formatBRL(cycle === "annual" ? tier.annualPrice : tier.monthlyPrice)}</p>
              <p className="text-xs text-[var(--text-muted)]">{cycle === "annual" ? "por ano" : "por mes"}</p>
            </button>
          );
        })}
      </div>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 rounded-[8px] border border-[var(--border)] bg-[var(--bg-card)] p-4 sm:p-6">
          {!active && !isAdmin ? (
            <div className="mt-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Forma de pagamento</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {Object.values(PAYMENT_METHODS).map((method) => {
                  const Icon = method.icon;
                  return (
                    <button key={method.id} type="button" onClick={() => setPaymentMethod(method.id)} aria-pressed={paymentMethod === method.id} className={`flex min-h-16 items-center gap-3 rounded-[8px] border p-3 text-left ${paymentMethod === method.id ? "border-[var(--accent-mint)] bg-[var(--hover-overlay)]" : "border-[var(--border)]"}`}>
                      <Icon className="size-5 shrink-0 text-[var(--text-primary)]" />
                      <span className="min-w-0"><strong className="block text-sm text-[var(--text-primary)]">{method.label}</strong><span className="block text-[11px] leading-4 text-[var(--text-muted)]">{method.description}</span></span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="mt-6">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Incluido no {selectedTier.label}</h3>
            <PlanBenefitList benefits={selectedTier.benefits} itemClassName="mt-3 flex items-start gap-2 text-sm text-[var(--text-secondary)]" iconClassName="mt-0.5 size-4 shrink-0 text-[var(--accent-mint)]" />
          </div>
        </div>

        <aside className="h-fit rounded-[8px] border border-[var(--border)] bg-[var(--bg-card)] p-5">
          <p className="text-xs uppercase text-[var(--text-muted)]">Resumo</p>
          <h2 className="mt-2 text-lg font-semibold text-[var(--text-primary)]">{selectedTier.label} {CYCLES[cycle].label}</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{priceCaption}</p>
          <p className="mt-4 text-xs leading-5 text-[var(--text-muted)]">
            {active ? (isRecurringStripe ? "A Stripe calcula a diferenca proporcional e so confirma a mudanca depois da cobranca." : "Seu acesso atual foi comprado por PIX e nao possui renovacao automatica.") : paymentMethod === "PIX" ? "Pagamento unico. O acesso comeca quando a Stripe confirmar o PIX." : "Assinatura recorrente. Voce pode cancelar a renovacao quando quiser."}
          </p>
          <button type="button" onClick={handlePrimaryAction} disabled={Boolean(working) || isCurrentPlan || isAdmin || (active && !isRecurringStripe)} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-[8px] bg-[var(--text-primary)] px-4 text-sm font-semibold text-[var(--bg-card)] disabled:cursor-not-allowed disabled:opacity-50">
            {working === "checkout" ? <Loader2 className="size-4 animate-spin" /> : null}
            {isAdmin ? "Acesso administrativo" : isCurrentPlan ? "Plano atual" : active && !isRecurringStripe ? "Disponivel ao fim do acesso" : canChangePlan ? "Alterar plano" : `Pagar com ${PAYMENT_METHODS[paymentMethod].label}`}
          </button>
          <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-[var(--text-muted)]"><ShieldCheck className="size-3.5" /> Checkout hospedado pela Stripe</div>
        </aside>
      </section>
      {cancelSurvey.dialog}
    </main>
  );
}
