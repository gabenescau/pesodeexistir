import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentSubscription, isActiveSubscription } from "@/lib/subscription";
import { useAuth } from "@/app/data/AuthContext";

export function ProcessingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState("pending");
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) {
      navigate("/entrar");
      return;
    }

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 30;

    async function poll() {
      while (!cancelled && attempts < maxAttempts) {
        attempts++;
        try {
          const sub = await getCurrentSubscription(user.id);
          if (cancelled) return;

          if (sub) {
            setStatus(sub.status);

            if (isActiveSubscription(sub)) {
              await new Promise((r) => setTimeout(r, 1500));
              if (!cancelled) {
                navigate("/app/inicio");
                return;
              }
            }
          }
        } catch (e) {
          if (cancelled) return;
          setError(e.message);
        }

        if (!cancelled && attempts < maxAttempts) {
          await new Promise((r) => setTimeout(r, 3000));
        }
      }

      if (!cancelled && attempts >= maxAttempts) {
        setStatus("timeout");
      }
    }

    poll();

    return () => { cancelled = true; };
  }, [user, navigate]);

  const statusMessages = {
    pending: "Verificando pagamento...",
    active: "Pagamento confirmado! Redirecionando...",
    past_due: "Pagamento pendente. Pode levar alguns minutos.",
    canceled: "Assinatura cancelada.",
    expired: "Assinatura expirada.",
    refunded: "Pagamento estornado.",
    chargeback: "Pagamento contestado.",
    timeout: "O pagamento pode estar demorando mais que o esperado. Receberá um email quando for confirmado.",
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: "var(--bg-page)" }}>
      <div className="max-w-sm w-full text-center space-y-6">
        <div className="size-12 mx-auto">
          {status === "active" ? (
            <svg className="size-12 text-[var(--accent-mint)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <div className="size-8 border-2 border-[var(--border)] border-t-[var(--text-primary)] rounded-full animate-spin mx-auto" />
          )}
        </div>

        <h1 className="text-[24px] font-[600] leading-[32px] tracking-[-0.96px] text-[var(--text-primary)]">
          {status === "active" ? "Assinatura confirmada!" : "Processando pagamento"}
        </h1>

        <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
          {statusMessages[status] || "Aguardando confirmação..."}
        </p>

        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        {status === "timeout" && (
          <button
            onClick={() => navigate("/assinar")}
            className="px-6 py-3 rounded-[100px] bg-[var(--text-primary)] text-[var(--bg-card)] text-[14px] font-[500] leading-[20px] hover:opacity-90 transition-all"
          >
            Tentar novamente
          </button>
        )}
      </div>
    </div>
  );
}
