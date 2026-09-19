import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/app/data/AuthContext";
import { useData } from "@/app/data/DataContext";
import { authenticatedApiPost } from "@/lib/authenticated-api";
import { CYCLES, TIERS, formatBRL, getTierPlanKey, planInfoFromCode } from "@/lib/plans";
import { getCurrentSubscription, isActiveSubscription } from "@/lib/subscription";
import { Loader2, ShieldCheck } from "@/lib/icons";
import { PlanBenefitList } from "@/components/plan-benefit";
import { toast } from "@/lib/toast";
import { AsaasPixModal } from "@/app/components/AsaasPixModal";

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const TIER_ORDER = ["pensador", "leitor"];

export function SubscribePage() {
  const { user, isAdmin } = useAuth();
  const { subscription } = useData();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const checkoutState = searchParams.get("checkout");
  const checkoutAttemptId = searchParams.get("attempt_id");
  const requestedTier = searchParams.get("plan");
  const requestedCycle = searchParams.get("ciclo");
  const [tierId, setTierId] = useState(TIERS[requestedTier] ? requestedTier : "pensador");
  const [cycle, setCycle] = useState(CYCLES[requestedCycle] ? requestedCycle : "monthly");
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [checkoutMessage, setCheckoutMessage] = useState("");
  const [pixOpen, setPixOpen] = useState(false);
  const [pixPlanKey, setPixPlanKey] = useState(null);
  const [pixPayment, setPixPayment] = useState(null);
  const [pixError, setPixError] = useState("");

  const visibleSubscription = currentSubscription || subscription;
  const active = isActiveSubscription(visibleSubscription);
  const currentInfo = planInfoFromCode(visibleSubscription?.plan);
  const selectedTier = TIERS[tierId];

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
    if (checkoutState === "canceled" || checkoutState === "expired") {
      toast.info(checkoutState === "expired"
        ? "Checkout expirado. Nenhuma cobrança foi feita."
        : "Checkout cancelado. Nenhuma cobrança foi feita.");
      setSearchParams({}, { replace: true });
      return;
    }
    if (checkoutState !== "success" || !checkoutAttemptId || !user) return;

    let cancelled = false;
    async function confirmCheckout() {
      setWorking("confirm");
      setCheckoutMessage("Confirmando o pagamento com o Asaas...");
      try {
        for (let attempt = 0; attempt < 12; attempt += 1) {
          const result = await authenticatedApiPost("/api/asaas-billing", { action: "status", attemptId: checkoutAttemptId });
          if (result.paid) {
            toast.success("Pagamento confirmado. Seu acesso está ativo.");
            window.location.replace("/app/inicio?payment=success");
            return;
          }
          if (result.status === "expired" || result.status === "canceled") throw new Error("O checkout terminou sem pagamento.");
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
  }, [checkoutAttemptId, checkoutState, setSearchParams, user]);

  function handlePlanSelection(nextTierId) {
    setTierId(nextTierId);
    if (active && currentInfo?.tier === nextTierId && currentInfo?.cycle === cycle) {
      toast.info("Este ja e o seu plano atual.");
      return;
    }
    setPixPlanKey(getTierPlanKey(nextTierId, cycle));
    setPixPayment(null);
    setPixError("");
    setPixOpen(true);
  }

  async function handlePixSubmit(form) {
    if (working || !pixPlanKey) return;
    setWorking("pix");
    setPixError("");
    try {
      const randomPart = window.crypto?.getRandomValues
        ? Array.from(window.crypto.getRandomValues(new Uint32Array(2))).join("")
        : "retry";
      const attemptId = window.crypto?.randomUUID?.() || `checkout-${Date.now()}-${randomPart}`;
      const result = await authenticatedApiPost("/api/asaas-billing", {
        action: "create",
        plan: pixPlanKey,
        attemptId,
        ...form,
      });
      if (!result?.qrCode?.payload) throw new Error("A Asaas nao retornou um Pix valido.");
      setPixPayment(result);
    } catch (error) {
      setPixError(error?.message || "Nao foi possivel gerar o Pix.");
    } finally {
      setWorking("");
    }
  }

  useEffect(() => {
    if (!pixOpen || !pixPayment?.attemptId) return undefined;
    let cancelled = false;
    let timer;
    let checks = 0;
    async function pollPayment() {
      try {
        const result = await authenticatedApiPost("/api/asaas-billing", {
          action: "status",
          attemptId: pixPayment.attemptId,
        });
        if (cancelled) return;
        if (result?.paid) {
          toast.success("Pagamento confirmado. Seu acesso esta ativo.");
          window.location.replace("/app/inicio?payment=success");
          return;
        }
        if (["expired", "canceled"].includes(result?.status)) {
          setPixError("Este Pix expirou ou foi cancelado. Gere um novo codigo.");
          setPixPayment(null);
          return;
        }
      } catch (error) {
        if (!cancelled && checks >= 2) setPixError(error?.message || "Nao foi possivel consultar o pagamento.");
      }
      checks += 1;
      if (!cancelled && checks < 24) timer = window.setTimeout(pollPayment, 5000);
    }
    pollPayment();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [pixOpen, pixPayment?.attemptId]);

  if (loading) {
    return (
      <div className="flex min-h-[50dvh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  const orderedTiers = TIER_ORDER.map((id) => TIERS[id]).filter(Boolean);
  const pixPlan = pixPlanKey
    ? (() => {
      const [tier, selectedCycle] = pixPlanKey.split("-");
      const config = TIERS[tier];
      if (!config) return null;
      return {
        name: `${config.label} ${selectedCycle === "annual" ? "Anual" : "Mensal"}`,
        price: selectedCycle === "annual" ? config.annualPrice : config.monthlyPrice,
      };
    })()
    : null;

  return (
    <>
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-16">

      {/* ── Header Clean ── */}
      <header className="mb-10 text-center">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">
          OPE Club
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight text-[var(--text-primary)] sm:text-4xl">
          Invista na sua leitura
        </h1>
      </header>

      {/* ── Checkout feedback ── */}
      {checkoutMessage && (
        <div className="mb-8 flex items-center justify-center gap-3 rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-4 text-sm text-[var(--text-secondary)] shadow-sm">
          {working === "confirm" ? (
            <Loader2 className="size-4 animate-spin text-[var(--accent-mint)]" />
          ) : (
            <ShieldCheck className="size-4 text-[var(--accent-mint)]" />
          )}
          <span>{checkoutMessage}</span>
        </div>
      )}

      {/* ── Plano Ativo ── */}
      {(active || isAdmin) && (
        <section className="mb-8 flex flex-col gap-3 rounded-[16px] border border-[var(--border)] bg-[var(--bg-card)] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Seu plano atual</p>
            <p className="mt-0.5 text-base font-bold text-[var(--text-primary)]">
              {isAdmin ? "Acesso administrativo" : currentInfo?.tierLabel || "OPE Club"}
            </p>
            {!isAdmin && visibleSubscription?.current_period_end && (
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                {visibleSubscription.cancel_at_period_end
                  ? "Renovação cancelada, acesso até "
                  : "Próxima renovação em "}
                {new Date(visibleSubscription.current_period_end).toLocaleDateString("pt-BR")}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate("/app/configuracoes?aba=assinatura")}
              className="min-h-9 rounded-[8px] border border-[var(--border)] px-4 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--hover-overlay)] transition-colors"
            >
              Gerenciar
            </button>
          </div>
        </section>
      )}

      {/* ── Frequência de cobrança (Mensal / Anual) ── */}
      <div className="mb-8 flex flex-col items-center gap-2">
        <div
          className="inline-flex rounded-full border border-[var(--border)] bg-[var(--bg-card)] p-1 shadow-sm"
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
                className={`flex items-center gap-1.5 rounded-full px-5 py-2 text-xs font-bold transition-all focus-visible:outline-none ${
                  selected
                    ? "bg-[var(--text-primary)] text-[var(--bg-card)] shadow-sm"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                {item.label}
                {item.id === "annual" && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[9px] font-extrabold ${
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
      </div>

      {/* ── Cards de Planos Clean — Pensador primeiro ── */}
      <div className="grid gap-6 sm:grid-cols-2">
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
              className={`relative flex flex-col rounded-[24px] border p-6 sm:p-8 transition-all ${
                isPensador
                  ? "border-[var(--text-primary)] bg-[var(--bg-card)] shadow-[0_12px_48px_rgba(0,0,0,0.25)] order-first sm:order-first"
                  : "border-[var(--border)] bg-[var(--bg-card)]"
              }`}
            >
              {/* Badge Pensador */}
              {isPensador && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-[var(--text-primary)] px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest text-[var(--bg-card)] shadow-sm">
                    Mais completo
                  </span>
                </div>
              )}

              {/* Título & Descrição */}
              <div className="mb-6">
                <h3 className="text-lg font-bold uppercase tracking-wider text-[var(--text-primary)]">
                  {tier.id === "pensador" ? "Pensador" : "Leitor"}
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-muted)]">
                  {tier.description}
                </p>
              </div>

              {/* Preço */}
              <div className="mb-1 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold tracking-tight text-[var(--text-primary)]">
                  {formatBRL(monthlyDisplay)}
                </span>
                <span className="text-xs font-medium text-[var(--text-muted)]">/mês</span>
              </div>
              <p className="mb-6 text-[11px] text-[var(--text-muted)]">
                {cycle === "annual"
                  ? `${formatBRL(tier.annualPrice)} cobrados por ano`
                  : "cobrado mensalmente"}
              </p>

              {/* Divisor minimalista */}
              <div className="mb-6 h-px w-full bg-[var(--border)]" />

              {/* Lista de Benefícios */}
              <div className="mb-8 flex-1">
                <PlanBenefitList
                  benefits={tier.benefits}
                  itemClassName="flex items-start gap-3 text-xs text-[var(--text-secondary)]"
                  iconClassName={`mt-0.5 size-4 shrink-0 ${isPensador ? "text-[var(--accent-mint)]" : "text-[var(--text-primary)]"}`}
                />
              </div>

              {/* Botão de Assinatura */}
              <button
                type="button"
                disabled={Boolean(working)}
                onClick={() => handlePlanSelection(tier.id)}
                className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-full text-xs font-bold transition-all disabled:opacity-60 ${
                  isPensador
                    ? "bg-[var(--text-primary)] text-[var(--bg-card)] hover:opacity-90 active:scale-[0.99]"
                    : "border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--hover-overlay)] active:scale-[0.99]"
                }`}
              >
                {working === "pix" && isSelected ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Processando...
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

    </main>
    <AsaasPixModal
      isOpen={pixOpen}
      plan={pixPlan}
      defaultEmail={user?.email || ""}
      defaultName={user?.user_metadata?.name || ""}
      working={working === "pix" ? working : ""}
      error={pixError}
      payment={pixPayment}
      onClose={() => { if (!working) setPixOpen(false); }}
      onSubmit={handlePixSubmit}
    />
    </>
  );
}
