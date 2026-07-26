import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/app/data/AuthContext";
import { getCurrentSubscription, isActiveSubscription } from "@/lib/subscription";
import { SubscribeModal } from "./SubscribeModal";

export function SubscriptionGuard({ children }) {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
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

    if (isAdmin) {
      setState("active");
      return;
    }

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

  if (state === "unauthenticated") {
    return <Navigate to="/entrar" replace />;
  }

  // Sem plano: em vez de trocar de rota, mostra o conteúdo bloqueado (borrado)
  // com o pop-up de assinatura por cima. Fechar o modal volta para o início.
  if (state === "inactive") {
    return (
      <div className="relative">
        <div className="pointer-events-none max-h-[70vh] select-none overflow-hidden opacity-40 blur-sm" aria-hidden>
          {children}
        </div>
        <SubscribeModal open onClose={() => navigate("/app/inicio")} />
      </div>
    );
  }

  return children;
}
