import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/app/data/AuthContext";
import { useData } from "@/app/data/DataContext";
import { hasPlanFeature } from "@/lib/entitlements";
import { Lock } from "@/lib/icons";

function Paywall({ feature }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  function goToPlans() {
    if (!user) {
      navigate("/entrar");
      return;
    }
    navigate("/app/planos");
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-5 text-center">
        <div className="flex size-14 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-card)]">
          <Lock className="size-6 text-[var(--text-muted)]" />
        </div>
        <div className="space-y-2">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            {feature === "missions"
              ? "As missoes fazem parte dos planos Leitor e Pensador"
              : feature
                ? "Este recurso faz parte do Plano Pensador"
                : "Sua assinatura nao esta ativa"}
          </h2>
          <p className="text-sm leading-relaxed text-[var(--text-muted)]">
            {feature === "missions"
              ? "Tenha um plano ativo para receber novos objetivos todos os dias e trocar seus creditos na loja."
              : feature
                ? "Atualize seu plano para liberar este recurso e os beneficios exclusivos."
              : "Para acessar este conteudo, voce precisa de um plano ativo do OPE Club."}
          </p>
        </div>
        <button
          type="button"
          onClick={goToPlans}
          className="w-full rounded-full bg-[var(--text-primary)] py-3 text-sm font-semibold text-[var(--bg-card)] transition-opacity hover:opacity-90"
        >
          Ver planos
        </button>
        <p className="text-xs text-[var(--text-muted)]">Cancele a qualquer momento, sem burocracia.</p>
      </div>
    </div>
  );
}

export function SubscriptionGuard({ children, feature }) {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const { subscription, loading: dataLoading } = useData();
  const [state, setState] = useState("loading");

  useEffect(() => {
    if (authLoading) {
      setState("loading");
      return;
    }
    if (!user) {
      setState("unauthenticated");
      return;
    }
    if (dataLoading) {
      setState("loading");
      return;
    }
    if (isAdmin) {
      setState("active");
      return;
    }
    setState(hasPlanFeature({ isAdmin, subscription, feature }) ? "active" : "inactive");
  }, [user, isAdmin, authLoading, dataLoading, subscription, feature]);

  if (state === "loading") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="size-6 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--text-primary)]" />
      </div>
    );
  }

  if (state === "unauthenticated") return <Navigate to="/entrar" replace />;
  if (state === "inactive") return <Paywall feature={feature} />;

  return children;
}
