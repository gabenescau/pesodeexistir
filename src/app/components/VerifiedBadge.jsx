import { SealCheck } from "@/lib/icons";

export function VerifiedBadge({ className = "size-4 text-[#3b82f6]", title = "Verificado" }) {
  return <SealCheck weight="fill" aria-label={title} role="img" className={className} />;
}
