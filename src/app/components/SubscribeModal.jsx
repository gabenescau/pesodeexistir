import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/app/data/AuthContext";
import { TIERS, formatBRL } from "@/lib/plans";
import { Check, Lock, X } from "@/lib/icons";

const DEFAULT_BENEFITS = [
  "Acesso completo a biblioteca",
  "Comunidade exclusiva de leitores",
  "Comentarios e clubes de leitura",
  "Lancamentos semanais",
  "Sem anuncios",
];

export function SubscribeModal({
  open,
  onClose,
  dismissible = true,
  title = "Conteudo exclusivo para assinantes",
  description = "Assine o OPE Club para desbloquear a biblioteca e a comunidade.",
  benefits = DEFAULT_BENEFITS,
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState("pensador");

  if (!open) return null;

  function goToPlans() {
    if (!user) {
      navigate("/entrar");
      return;
    }
    navigate(`/app/planos?plan=${selectedPlan}`);
  }

  const plan = TIERS[selectedPlan];
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button type="button" aria-label="Fechar" onClick={dismissible ? onClose : undefined} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div role="dialog" aria-modal="true" aria-labelledby="subscribe-title" className="relative z-10 max-h-[92dvh] w-full overflow-y-auto rounded-t-[8px] border border-[var(--border)] bg-[var(--bg-card)] shadow-[var(--shadow-sm)] sm:max-w-lg sm:rounded-[8px]">
        {dismissible ? (
          <button type="button" onClick={onClose} aria-label="Fechar" className="absolute right-3 top-3 flex size-11 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--hover-overlay)]">
            <X className="size-5" />
          </button>
        ) : null}
        <div className="px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-8 text-center sm:px-6 sm:pb-6">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-[8px] bg-[var(--hover-overlay)]"><Lock className="size-6" /></div>
          <h2 id="subscribe-title" className="pr-8 text-lg font-semibold text-[var(--text-primary)] sm:pr-0">{title}</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{description}</p>

          <div className="mt-5 grid grid-cols-2 gap-2">
            {Object.values(TIERS).map((item) => (
              <button key={item.id} type="button" onClick={() => setSelectedPlan(item.id)} aria-pressed={selectedPlan === item.id} className={`min-w-0 rounded-[8px] border p-3 text-left ${selectedPlan === item.id ? "border-[var(--accent-mint)] bg-[var(--hover-overlay)]" : "border-[var(--border)]"}`}>
                <span className="block truncate text-sm font-semibold text-[var(--text-primary)]">{item.label}</span>
                <span className="mt-1 block text-lg font-bold text-[var(--text-primary)]">{formatBRL(item.monthlyPrice)}<small className="text-[10px] font-normal text-[var(--text-muted)]">/mes</small></span>
              </button>
            ))}
          </div>

          <ul className="mt-5 space-y-2.5 text-left">
            {benefits.map((benefit) => (
              <li key={benefit} className="flex items-start gap-2.5 text-sm text-[var(--text-secondary)]"><Check className="mt-0.5 size-4 shrink-0 text-[var(--accent-mint)]" />{benefit}</li>
            ))}
          </ul>
          <button type="button" onClick={goToPlans} className="mt-6 min-h-12 w-full rounded-[8px] bg-[var(--text-primary)] px-5 text-sm font-medium text-[var(--bg-card)]">Ver {plan.label}</button>
        </div>
      </div>
    </div>
  );
}
