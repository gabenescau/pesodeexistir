import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/app/data/AuthContext";
import { getCurrentSubscription, isActiveSubscription } from "@/lib/subscription";
import { Check } from "@/lib/icons";

const LEITOR_BENEFITS = [
  "Biblioteca completa de filosofia",
  "Leitor digital nativo no aplicativo",
  "Feed ativo para discussões",
  "Adquira créditos diariamente",
  "Troque créditos por livros e itens na loja",
];

const PENSADOR_BENEFITS = [
  "Todos os benefícios do plano leitor",
  "Selo de verificado",
  "Acesso às seasons",
  "Suporte exclusivo WhatsApp",
  "Acesso antecipado a novos livros",
];

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
    <div className="mx-auto w-full max-w-2xl space-y-6 py-6">
      {/* Header */}
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Assinatura</p>
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Escolha seu plano</h1>
        <p className="text-sm text-[var(--text-muted)]">Cancele a qualquer momento sem taxa ou burocracia.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Plano Pensador — R$ 29/mês */}
        <div className="relative flex flex-col rounded-[14px] border border-[var(--text-primary)] bg-[var(--bg-card)] p-5 space-y-4">
          {/* Tag popular */}
          <span className="absolute -top-2.5 left-4 rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-primary)]">
            Mais popular
          </span>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Pensador</p>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-bold text-[var(--text-primary)]">R$ 29</span>
              <span className="text-xs text-[var(--text-muted)]">/mês</span>
            </div>
          </div>

          <ul className="space-y-2 flex-1">
            {PENSADOR_BENEFITS.map((b) => (
              <li key={b} className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
                <Check className="size-3.5 shrink-0 mt-0.5 text-[var(--text-primary)]" />
                {b}
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={irParaPlanos}
            className="w-full rounded-[10px] bg-[var(--text-primary)] py-2.5 text-sm font-semibold text-[var(--bg-card)] hover:opacity-90 transition-opacity"
          >
            Assinar Pensador
          </button>
        </div>

        {/* Plano Leitor — R$ 19/mês */}
        <div className="flex flex-col rounded-[14px] border border-[var(--border)] bg-[var(--bg-card)] p-5 space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Leitor</p>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-bold text-[var(--text-primary)]">R$ 19</span>
              <span className="text-xs text-[var(--text-muted)]">/mês</span>
            </div>
          </div>

          <ul className="space-y-2 flex-1">
            {LEITOR_BENEFITS.map((b) => (
              <li key={b} className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
                <Check className="size-3.5 shrink-0 mt-0.5 text-[var(--text-muted)]" />
                {b}
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={irParaPlanos}
            className="w-full rounded-[10px] border border-[var(--border)] py-2.5 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--hover-overlay)] transition-colors"
          >
            Assinar Leitor
          </button>
        </div>
      </div>

      <p className="text-center text-xs text-[var(--text-muted)]">
        Acesse a pagina de planos para gerenciar sua assinatura.
      </p>
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
