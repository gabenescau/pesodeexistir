// Renderiza um item da lista de beneficios de um plano. Quando o beneficio
// traz um `icon` especial, injeta o destaque visual (selo de verificado,
// icone do Instagram) ao lado do texto para nao repetir o markup nos 3 pontos
// onde a lista aparece (SubscribePage, pricing-section, pricing-monthly).
import { Fragment } from "react";
import { CheckIcon, InstagramLogo } from "@/lib/icons";
import { VerifiedBadge } from "@/app/components/VerifiedBadge";

function BenefitIcon({ kind }) {
  if (kind === "verified") {
    return <VerifiedBadge className="size-3.5 shrink-0 text-[var(--accent-mint)]" title="Selo de verificado" />;
  }
  if (kind === "instagram") {
    return <InstagramLogo className="size-3.5 shrink-0" aria-label="Instagram" />;
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

export function PlanBenefitList({ benefits, itemClassName, iconClassName, showCheck = true, separator = false }) {
  return (
    <ul className="space-y-2.5">
      {benefits.map((benefit, index) => {
        const previous = benefits[index - 1];
        const isFirstExclusive = separator && benefit.annualOnly && index > 0 && previous && !previous.annualOnly;
        return (
          <Fragment key={benefit.text + index}>
            {isFirstExclusive ? (
              <li className="pt-3 text-[10px] font-[700] uppercase tracking-[0.18em] text-[var(--accent-mint)]">
                Exclusivo do plano anual
              </li>
            ) : null}
            <PlanBenefitItem
              benefit={benefit}
              iconClassName={iconClassName}
              className={itemClassName}
              showCheck={showCheck}
            />
          </Fragment>
        );
      })}
    </ul>
  );
}
