import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, isSupabaseReady } from "@/app/data/supabase";
import { useAuth } from "@/app/data/AuthContext";
import { getCurrentSubscription, isActiveSubscription } from "@/lib/subscription";

const CHECKOUT_URL = import.meta.env.VITE_CAKTO_CHECKOUT_URL || "https://pay.cakto.com.br/yxdvb3z_700613";

export function SubscribePage() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const isSupabase = isSupabaseReady();

  useEffect(() => {
    if (!user) {
      navigate("/entrar");
      return;
    }

    if (isAdmin) {
      navigate("/app/inicio");
      return;
    }

    getCurrentSubscription(user.id).then((sub) => {
      if (isActiveSubscription(sub)) {
        navigate("/app/inicio");
      }
      setLoading(false);
    });
  }, [user, isAdmin, navigate]);

  async function handleSubscribe() {
    if (!user) return;
    setCreating(true);
    setError(null);

    try {
      if (isSupabase) {
        const { error: insertError } = await supabase
          .from("checkout_sessions")
          .insert({
            user_id: user.id,
            user_email: user.email,
            status: "pending",
            checkout_url: CHECKOUT_URL,
          });

        if (insertError) {
          console.warn("Sessão local de checkout não foi registrada:", insertError.message);
        }
      }

      window.location.assign(CHECKOUT_URL);
    } catch (e) {
      setError(e.message || "Erro ao iniciar assinatura");
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="size-6 border-2 border-[var(--border)] border-t-[var(--text-primary)] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: "var(--bg-page)" }}>
      <div className="max-w-md w-full space-y-8 text-center">
        <div>
          <h1 className="text-[32px] font-[600] leading-[40px] tracking-[-1.28px] text-[var(--text-primary)]">
            OPE Club
          </h1>
          <p className="text-[16px] mt-2" style={{ color: "var(--text-muted)" }}>
            Biblioteca, comunidade e clubes de leitura
          </p>
        </div>

        <div
          className="rounded-[16px] p-8 space-y-6"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-md)",
          }}
        >
          <div className="space-y-2">
            <div className="text-[40px] font-[700] tracking-[-1.6px] text-[var(--text-primary)]">
              R$ 27
              <span className="text-[16px] font-[400] tracking-normal" style={{ color: "var(--text-muted)" }}>/mês</span>
            </div>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Cancele quando quiser. Renovação automática mensal.
            </p>
          </div>

          <ul className="space-y-3 text-left">
            {[
              "Acesso completo à biblioteca",
              "Comunidade exclusiva de leitores",
              "Grupos de leitura (clubes)",
              "Participação em eventos ao vivo",
              "Leitura offline",
              "Sem anúncios",
            ].map((f) => (
              <li key={f} className="flex items-center gap-3 text-sm" style={{ color: "var(--text-secondary)" }}>
                <svg className="size-4 shrink-0 text-[var(--accent-mint)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                {f}
              </li>
            ))}
          </ul>

          <button
            onClick={handleSubscribe}
            disabled={creating}
            className="w-full py-3 rounded-[100px] bg-[var(--text-primary)] text-[var(--bg-card)] text-[16px] font-[500] leading-[24px] hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? (
              <span className="flex items-center justify-center gap-2">
                <div className="size-4 border-2 border-[var(--bg-card)] border-t-transparent rounded-full animate-spin" />
                Redirecionando...
              </span>
            ) : (
              "Assinar agora"
            )}
          </button>

          {error && (
            <p className="text-sm text-red-400 mt-4">{error}</p>
          )}
        </div>

        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Pagamento processado com segurança pela Cakto.
        </p>
      </div>
    </div>
  );
}
