// Renderiza um item da lista de beneficios de um plano. Quando o beneficio
// traz um `icon` especial, injeta o destaque visual (selo de verificado,
// icone do Instagram) ao lado do texto para nao repetir o markup nos 3 pontos
// onde a lista aparece (SubscribePage, pricing-section, pricing-monthly).
import { CheckIcon } from "@/lib/icons";
import { VerifiedBadge } from "@/app/components/VerifiedBadge";

function BenefitIcon({ kind }) {
  if (kind === "verified") {
    return <VerifiedBadge className="size-3.5 shrink-0 text-[#3b82f6]" title="Selo de verificado" />;
  }
  if (kind === "instagram") {
    return (
      <svg viewBox="0 0 24 24" className="size-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-label="Instagram">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" />
      </svg>
    );
  }
  return null;
}

export function PlanBenefitItem({ benefit, iconClassName = "size-3.5 shrink-0 text-[var(--accent-mint)]", className = "flex items-center gap-2 text-[13px] text-[var(--text-secondary)]", showCheck = true }) {
  return (
    <li className={className}>
      {showCheck ? <CheckIcon className={iconClassName} strokeWidth={2.5} /> : null}
      <BenefitIcon kind={benefit.icon} />
      <span className="leading-relaxed">{benefit.text}</span>
    </li>
  );
}
