import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/app/data/AuthContext";
import { useData } from "@/app/data/DataContext";
import { authenticatedApiPost } from "@/lib/authenticated-api";
import { CYCLES, TIERS, formatBRL, getTierPlanKey, planInfoFromCode } from "@/lib/plans";
import { getCurrentSubscription, isActiveSubscription } from "@/lib/subscription";
import { PlanBenefitList } from "@/components/plan-benefit";
import { Loader2, ShieldCheck } from "@/lib/icons";
import { toast } from "@/lib/toast";
import { useCancelSurvey } from "@/components/ui/cancel-survey";
import { parseCheckoutInput, parseSubscriptionInput } from "@/lib/api-contracts";

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
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [checkoutMessage, setCheckoutMessage] = useState("");

  const visibleSubscription = currentSubscription || subscription;
  const active = isActiveSubscription(visibleSubscription);
  const currentInfo = planInfoFromCode(visibleSubscription?.plan);
  const selectedTier = TIERS[tierId];
  const isRecurringStripe = visibleSubscription?.provider === "stripe" && Boolean(visibleSubscription?.provider_subscription_id);

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

  async function handlePlanAction(planKey) {
    if (working) return;
    if (active && !isRecurringStripe) {
      toast.info("Seu acesso atual continua valido ate a data exibida. Depois disso, escolha um novo plano.");
      return;
    }
    setWorking("checkout");
    try {
      const currentPlanKey = currentInfo ? `${currentInfo.tier}-${currentInfo.cycle}` : null;
      const changingRecurringPlan = active && isRecurringStripe && currentPlanKey && currentPlanKey !== planKey;
      if (changingRecurringPlan) {
        const changePlanInput = parseSubscriptionInput({
          subscriptionId: visibleSubscription.id,
          plan: planKey,
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
        plan: planKey,
        paymentMethod: "CARD",
        attemptId: window.crypto?.randomUUID?.() || `checkout-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      });
      setCheckoutMessage("Redirecionando voce para o checkout seguro da Stripe...");
      const result = await authenticatedApiPost("/api/stripe-checkout", checkoutInput);
      if (!result?.url) throw new Error("A Stripe nao retornou o endereco do checkout.");
      window.location.assign(result.url);
    } catch (error) {
      setCheckoutMessage("");
      toast.error(error?.message || "Nao foi possivel abrir o checkout.");
    } finally {
      setWorking("");
    }
  }

  function handlePlanSelection(nextTierId) {
    setTierId(nextTierId);
    if (isAdmin || (active && currentInfo?.tier === nextTierId && currentInfo?.cycle === cycle)) {
      return;
    }
    void handlePlanAction(getTierPlanKey(nextTierId, cycle));
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
                {visibleSubscription.cancel_at_period_end ? "Renovacao cancelada, acesso ate " : "Proximo ciclo em "}
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

      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        {Object.values(TIERS).map((tier) => {
          const selected = tier.id === tierId;
          const tierPrice = cycle === "annual" ? tier.annualPrice : tier.monthlyPrice;
          return (
            <button
              type="button"
              key={tier.id}
              onClick={() => handlePlanSelection(tier.id)}
              aria-pressed={selected}
              aria-busy={working === "checkout"}
              disabled={Boolean(working)}
              className={`min-w-0 rounded-[18px] border p-5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-mint)] sm:p-7 ${selected ? "border-[var(--accent-mint)] bg-[var(--text-primary)] text-[var(--bg-canvas)] shadow-[0_18px_50px_rgba(0,0,0,0.2)]" : "border-[var(--border)] bg-[var(--bg-card)] hover:-translate-y-0.5 hover:border-[var(--text-muted)]"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className={`text-xl font-semibold ${selected ? "text-[var(--bg-canvas)]" : "text-[var(--text-primary)]"}`}>{tier.label}</h2>
                  <p className={`mt-2 text-sm leading-5 ${selected ? "text-[var(--bg-canvas)]/70" : "text-[var(--text-muted)]"}`}>{tier.description}</p>
                </div>
                {tier.id === "pensador" ? <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase ${selected ? "bg-[var(--accent-mint)] text-[var(--bg-canvas)]" : "bg-[var(--accent-mint)]/10 text-[var(--accent-mint)]"}`}>Mais completo</span> : null}
              </div>
              <div className="mt-7 flex items-end gap-2">
                <p className={`text-4xl font-semibold tracking-tight ${selected ? "text-[var(--bg-canvas)]" : "text-[var(--text-primary)]"}`}>{formatBRL(cycle === "annual" ? Math.round(tier.annualPrice / 12) : tier.monthlyPrice)}</p>
                <p className={`pb-1 text-xs ${selected ? "text-[var(--bg-canvas)]/65" : "text-[var(--text-muted)]"}`}>/mes</p>
              </div>
              <p className={`mt-1 text-xs ${selected ? "text-[var(--bg-canvas)]/65" : "text-[var(--text-muted)]"}`}>{cycle === "annual" ? `${formatBRL(tierPrice)} cobrados por ano` : "cobranca mensal"}</p>
              <div className={`my-6 border-t ${selected ? "border-[var(--bg-canvas)]/15" : "border-[var(--border)]"}`} />
              <ul className="space-y-3">
                {tier.benefits.slice(0, 6).map((benefit) => (
                  <li key={benefit.text} className={`flex items-start gap-2 text-sm ${selected ? "text-[var(--bg-canvas)]/85" : "text-[var(--text-secondary)]"}`}>
                    <ShieldCheck className={`mt-0.5 size-4 shrink-0 ${selected ? "text-[var(--accent-mint)]" : "text-[var(--accent-mint)]"}`} />
                    <span>{benefit.text}</span>
                  </li>
                ))}
              </ul>
              <span className={`mt-7 flex min-h-11 items-center justify-center rounded-full px-4 text-sm font-semibold ${selected ? "bg-[var(--bg-canvas)] text-[var(--text-primary)]" : "bg-[var(--text-primary)] text-[var(--bg-card)]"}`}>
                {working === "checkout" && selected ? <><Loader2 className="mr-2 size-4 animate-spin" /> Redirecionando...</> : active && currentInfo?.tier === tier.id && currentInfo?.cycle === cycle ? "Plano atual" : "Escolher plano"}
              </span>
            </button>
          );
        })}
      </div>

      <section className="rounded-[8px] border border-[var(--border)] bg-[var(--bg-card)] p-4 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">{selectedTier.label} inclui</h3>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Escolha um plano acima para abrir o Checkout seguro da Stripe.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]"><ShieldCheck className="size-4 text-[var(--accent-mint)]" /> Checkout seguro da Stripe</div>
        </div>
        <PlanBenefitList benefits={selectedTier.benefits} itemClassName="mt-4 flex items-start gap-2 text-sm text-[var(--text-secondary)]" iconClassName="mt-0.5 size-4 shrink-0 text-[var(--accent-mint)]" />
      </section>
      {cancelSurvey.dialog}
    </main>
  );
}
