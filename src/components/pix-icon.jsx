import { cn } from "@/lib/utils";
import { PixLogo } from "@phosphor-icons/react";

// Logo PIX (Phosphor PixLogo).
export function PixIcon({ className = "", ...props }) {
  return <PixLogo className={cn("shrink-0", className)} {...props} />;
}
