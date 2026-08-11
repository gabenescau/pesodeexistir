import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/app/data/AuthContext";
import { getCurrentSubscription, isActiveSubscription } from "@/lib/subscription";
import { Lock } from "@/lib/icons";

function Paywall() {
  const { user } = useAuth();
  const navigate = useNavigate();

  function irParaPlanos() {
    if (!user) {
      navigate("/entrar");
      return;
    }
    navigate("/app/planos");
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="flex w-full max-w-sm flex-col items-center text-center gap-5">
        {/* Ícone */}
        <div className="flex size-14 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-card)]">
          <Lock className="size-6 text-[var(--text-muted)]" />
        </div>

        {/* Texto */}
        <div className="space-y-2">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            Sua assinatura não está ativa
          </h2>
          <p className="text-sm text-[var(--text-muted)] leading-relaxed">
            Para acessar esse conteúdo, você precisa de um plano ativo do OPE Club.
          </p>
        </div>

        {/* Botão */}
        <button
          type="button"
          onClick={irParaPlanos}
          className="w-full rounded-full bg-[var(--text-primary)] py-3 text-sm font-semibold text-[var(--bg-card)] hover:opacity-90 transition-opacity"
        >
          Ver planos
        </button>

        <p className="text-xs text-[var(--text-muted)]">
          Cancele a qualquer momento, sem burocracia.
        </p>
      </div>
    </div>
  );
}

export function SubscriptionGuard({ children }) {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [state, setState] = useState("loading");

  useEffect(() => {
    if (authLoading) { setState("loading"); return; }
    if (!user) { setState("unauthenticated"); return; }
    if (isAdmin) { setState("active"); return; }

    let cancelled = false;
    getCurrentSubscription(user.id).then((sub) => {
      if (cancelled) return;
      setState(isActiveSubscription(sub) ? "active" : "inactive");
    });
    return () => { cancelled = true; };
  }, [user, isAdmin, authLoading]);

  if (state === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="size-6 border-2 border-[var(--border)] border-t-[var(--text-primary)] rounded-full animate-spin" />
      </div>
    );
  }

  if (state === "unauthenticated") return <Navigate to="/entrar" replace />;
  if (state === "inactive") return <Paywall />;

  return children;
}
