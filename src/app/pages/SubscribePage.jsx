import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/app/data/AuthContext";
import { useData } from "@/app/data/DataContext";
import { authenticatedApiPost } from "@/lib/authenticated-api";
import { CYCLES, TIERS, formatBRL, getTierPlanKey, planInfoFromCode } from "@/lib/plans";
import { getCurrentSubscription, isActiveSubscription } from "@/lib/subscription";
import { PlanBenefitList } from "@/components/plan-benefit";
import { Loader2, ShieldCheck, Check } from "@/lib/icons";
import { toast } from "@/lib/toast";
import { useCancelSurvey } from "@/components/ui/cancel-survey";
import { parseCheckoutInput, parseSubscriptionInput } from "@/lib/api-contracts";

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

// Render tiers in this order — Pensador (most expensive) first
const TIER_ORDER = ["pensador", "leitor"];

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
  const isRecurringStripe =
    visibleSubscription?.provider === "stripe" &&
    Boolean(visibleSubscription?.provider_subscription_id);

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
      toast.info("Checkout cancelado. Nenhuma cobrança foi feita.");
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
            toast.success("Pagamento confirmado. Seu acesso está ativo.");
            window.location.replace("/app/inicio?payment=success");
            return;
          }
          if (result.status === "expired") throw new Error("O checkout expirou sem pagamento.");
          if (attempt < 11) await sleep(2500);
          if (cancelled) return;
        }
        setCheckoutMessage("O pagamento ainda está sendo processado. Atualize a página em alguns instantes.");
      } catch (error) {
        if (!cancelled) {
          setCheckoutMessage("");
          toast.error(error?.message || "Não foi possível confirmar o pagamento.");
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
      toast.info("Seu acesso atual continua válido até a data exibida. Depois disso, escolha um novo plano.");
      return;
    }
    setWorking("checkout");
    try {
      const currentPlanKey = currentInfo ? `${currentInfo.tier}-${currentInfo.cycle}` : null;
      const changingRecurringPlan =
        active && isRecurringStripe && currentPlanKey && currentPlanKey !== planKey;
      if (changingRecurringPlan) {
        const changePlanInput = parseSubscriptionInput({
          subscriptionId: visibleSubscription.id,
          plan: planKey,
        });
        const result = await authenticatedApiPost("/api/stripe-change-plan", { ...changePlanInput });
        toast.success(
          result.pending
            ? "Alteração solicitada. O plano muda quando a Stripe confirmar a cobrança."
            : "Plano alterado com sucesso."
        );
        return;
      }

      const checkoutInput = parseCheckoutInput({
        plan: planKey,
        paymentMethod: "CARD",
        attemptId:
          window.crypto?.randomUUID?.() ||
          `checkout-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      });
      setCheckoutMessage("Redirecionando você para o checkout seguro da Stripe...");
      const result = await authenticatedApiPost("/api/stripe-checkout", checkoutInput);
      if (!result?.url) throw new Error("A Stripe não retornou o endereço do checkout.");
      window.location.assign(result.url);
    } catch (error) {
      setCheckoutMessage("");
      toast.error(error?.message || "Não foi possível abrir o checkout.");
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
      toast.success("A renovação foi cancelada. O acesso continua até o fim do ciclo.");
    } catch (error) {
      toast.error(error?.message || "Não foi possível cancelar a assinatura.");
    } finally {
      setWorking("");
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50dvh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  const orderedTiers = TIER_ORDER.map((id) => TIERS[id]).filter(Boolean);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">

      {/* ── Header ── */}
      <header className="mb-8 text-center">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-[var(--accent-mint)]">
          OPE Club
        </p>
        <h1 className="text-2xl font-bold text-[var(--text-primary)] sm:text-3xl">
          Invista na sua leitura
        </h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Cancele a qualquer momento. Sem taxa, sem burocracia.
        </p>
      </header>

      {/* ── Checkout message ── */}
      {checkoutMessage && (
        <div className="mb-6 flex items-start gap-3 rounded-[10px] border border-[var(--border)] bg-[var(--bg-card)] p-4 text-sm text-[var(--text-secondary)]">
          {working === "confirm" ? (
            <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" />
          ) : (
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[var(--accent-mint)]" />
          )}
          {checkoutMessage}
        </div>
      )}

      {/* ── Active subscription banner ── */}
      {(active || isAdmin) && (
        <section className="mb-6 flex flex-col gap-3 rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Plano atual</p>
            <p className="mt-1 font-semibold text-[var(--text-primary)]">
              {isAdmin ? "Acesso administrativo" : currentInfo?.tierLabel || "OPE Club"}
            </p>
            {!isAdmin && visibleSubscription?.current_period_end && (
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                {visibleSubscription.cancel_at_period_end
                  ? "Renovação cancelada, acesso até "
                  : "Próximo ciclo em "}
                {new Date(visibleSubscription.current_period_end).toLocaleDateString("pt-BR")}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate("/app/configuracoes?aba=assinatura")}
              className="min-h-10 rounded-[8px] border border-[var(--border)] px-4 text-sm text-[var(--text-primary)] hover:bg-[var(--hover-overlay)] transition-colors"
            >
              Gerenciar
            </button>
            {!isAdmin && isRecurringStripe && !visibleSubscription.cancel_at_period_end && (
              <button
                type="button"
                onClick={handleCancel}
                disabled={Boolean(working)}
                className="min-h-10 rounded-[8px] border border-[var(--border)] px-4 text-sm text-red-400 disabled:opacity-50 hover:bg-red-500/5 transition-colors"
              >
                {working === "cancel" ? "Cancelando..." : "Cancelar renovação"}
              </button>
            )}
          </div>
        </section>
      )}

      {/* ── Billing cycle toggle ── */}
      <div className="mb-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <div
          className="flex rounded-full border border-[var(--border)] bg-[var(--bg-card)] p-1"
          role="radiogroup"
          aria-label="Frequência de cobrança"
        >
          {Object.values(CYCLES).map((item) => {
            const selected = cycle === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setCycle(item.id)}
                className={`flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-mint)] ${
                  selected
                    ? "bg-[var(--text-primary)] text-[var(--bg-card)] shadow-sm"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                {item.label}
                {item.id === "annual" && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      selected
                        ? "bg-[var(--accent-mint)] text-[var(--bg-canvas)]"
                        : "bg-[var(--accent-mint)]/15 text-[var(--accent-mint)]"
                    }`}
                  >
                    -{selectedTier.annualDiscountPercent}%
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {cycle === "annual" && (
          <p className="text-xs text-[var(--accent-mint)] font-medium">
            Economize até {TIERS.pensador.annualDiscountPercent}% com o plano anual
          </p>
        )}
      </div>

      {/* ── Plan cards — Pensador first on all screen sizes ── */}
      <div className="grid gap-4 sm:grid-cols-2">
        {orderedTiers.map((tier) => {
          const isPensador = tier.id === "pensador";
          const isSelected = tier.id === tierId;
          const isCurrentPlan =
            active && currentInfo?.tier === tier.id && currentInfo?.cycle === cycle;
          const monthlyDisplay =
            cycle === "annual"
              ? Math.round(tier.annualPrice / 12)
              : tier.monthlyPrice;

          return (
            <div
              key={tier.id}
              className={`relative flex flex-col rounded-[20px] border p-6 transition-all ${
                isPensador
                  ? "border-[var(--text-primary)] bg-[var(--bg-card)] shadow-[0_8px_40px_rgba(0,0,0,0.18)] order-first sm:order-first"
                  : "border-[var(--border)] bg-[var(--bg-card)]"
              }`}
            >
              {/* Badge */}
              {isPensador && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[var(--text-primary)] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--bg-card)]">
                  Mais completo
                </span>
              )}

              {/* Tier name + description */}
              <div className="mb-5">
                <p className={`text-xs font-semibold uppercase tracking-widest ${isPensador ? "text-[var(--accent-mint)]" : "text-[var(--text-muted)]"}`}>
                  {tier.id === "pensador" ? "Pensador" : "Leitor"}
                </p>
                <p className="mt-1 text-sm text-[var(--text-muted)] leading-relaxed">
                  {tier.description}
                </p>
              </div>

              {/* Price */}
              <div className="mb-1 flex items-end gap-1.5">
                <span className="text-4xl font-bold tracking-tight text-[var(--text-primary)]">
                  {formatBRL(monthlyDisplay)}
                </span>
                <span className="mb-1 text-sm text-[var(--text-muted)]">/mês</span>
              </div>
              <p className="mb-6 text-xs text-[var(--text-muted)]">
                {cycle === "annual"
                  ? `${formatBRL(tier.annualPrice)} cobrados por ano`
                  : "cobrado mensalmente"}
              </p>

              {/* Benefits */}
              <ul className="mb-6 flex-1 space-y-2.5">
                {tier.benefits.slice(0, 7).map((benefit) => (
                  <li key={benefit.text} className="flex items-start gap-2.5 text-sm text-[var(--text-secondary)]">
                    <Check className={`mt-0.5 size-4 shrink-0 ${benefit.exclusive ? "text-[var(--accent-mint)]" : "text-[var(--text-primary)]"}`} />
                    <span>{benefit.text}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <button
                type="button"
                disabled={Boolean(working)}
                onClick={() => handlePlanSelection(tier.id)}
                className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold transition-all disabled:opacity-60 ${
                  isPensador
                    ? "bg-[var(--text-primary)] text-[var(--bg-card)] hover:opacity-90"
                    : "border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--hover-overlay)]"
                }`}
              >
                {working === "checkout" && isSelected ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Redirecionando...
                  </>
                ) : isCurrentPlan ? (
                  "Plano atual"
                ) : isPensador ? (
                  "Assinar Pensador"
                ) : (
                  "Assinar Leitor"
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* ── Trust badges ── */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-xs text-[var(--text-muted)]">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="size-4 text-[var(--accent-mint)]" />
          Checkout seguro via Stripe
        </span>
        <span className="flex items-center gap-1.5">
          <Check className="size-4 text-[var(--accent-mint)]" />
          Cancele a qualquer momento
        </span>
        <span className="flex items-center gap-1.5">
          <Check className="size-4 text-[var(--accent-mint)]" />
          Sem taxas de cancelamento
        </span>
      </div>

      {/* ── Full benefit breakdown ── */}
      <section className="mt-8 rounded-[14px] border border-[var(--border)] bg-[var(--bg-card)] p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            {selectedTier.label} inclui
          </h3>
          <ShieldCheck className="size-4 text-[var(--accent-mint)]" />
        </div>
        <PlanBenefitList
          benefits={selectedTier.benefits}
          itemClassName="flex items-start gap-2 text-sm text-[var(--text-secondary)] py-2 border-b border-[var(--border)] last:border-0"
          iconClassName="mt-0.5 size-4 shrink-0 text-[var(--accent-mint)]"
        />
      </section>

      {cancelSurvey.dialog}
    </main>
  );
}
