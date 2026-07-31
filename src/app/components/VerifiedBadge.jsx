import { SealCheck } from "@/lib/icons";

export function VerifiedBadge({ className = "size-4 text-[var(--accent-mint)]", title = "Verificado" }) {
  return <SealCheck weight="fill" aria-label={title} role="img" className={className} />;
}
