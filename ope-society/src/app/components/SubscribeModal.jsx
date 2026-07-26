import { useNavigate } from "react-router-dom";
import { Check, Lock, X } from "lucide-react";

const CHECKOUT_URL = import.meta.env.VITE_CHECKOUT_URL || "";

const BENEFITS = [
  "Acesso completo à biblioteca",
  "Comunidade exclusiva de leitores",
  "Comentários e clubes de leitura",
  "Lançamentos semanais",
  "Sem anúncios",
];

// Pop-up de assinatura. Substitui o redirecionamento para /assinar: o usuário
// vê o conteúdo bloqueado atrás do modal e decide ali mesmo.
export function SubscribeModal({ open, onClose, dismissible = true }) {
  const navigate = useNavigate();
  if (!open) return null;

  function assinar() {
    if (CHECKOUT_URL) {
      window.location.assign(CHECKOUT_URL);
    } else {
      // Sem checkout configurado: cai na tela dedicada, que explica o próximo passo.
      navigate("/assinar");
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Fechar"
        onClick={dismissible ? onClose : undefined}
        className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm"
      />

      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-[0_30px_80px_rgba(0,0,0,.45)]">
        {dismissible && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)]"
          >
            <X className="size-4" />
          </button>
        )}

        <div className="px-6 pb-6 pt-8 text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-[var(--text-primary)]/10">
            <Lock className="size-6 text-[var(--text-primary)]" />
          </div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Conteúdo exclusivo para assinantes</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Assine o OPE Club para desbloquear a biblioteca e a comunidade.
          </p>

          <div className="mt-5 flex items-baseline justify-center gap-1">
            <span className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">R$ 27</span>
            <span className="text-sm text-[var(--text-muted)]">/mês</span>
          </div>

          <ul className="mt-5 space-y-2.5 text-left">
            {BENEFITS.map((b) => (
              <li key={b} className="flex items-center gap-2.5 text-sm text-[var(--text-secondary)]">
                <Check className="size-4 shrink-0 text-[var(--accent-mint)]" strokeWidth={2.5} />
                {b}
              </li>
            ))}
          </ul>

          <button
            onClick={assinar}
            className="mt-6 w-full rounded-full bg-[var(--text-primary)] px-5 py-3 text-sm font-medium text-[var(--bg-card)] transition-opacity hover:opacity-90"
          >
            Assinar agora
          </button>
          <p className="mt-3 text-xs text-[var(--text-muted)]">Cancele quando quiser.</p>
        </div>
      </div>
    </div>
  );
}
