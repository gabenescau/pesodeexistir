import { cn } from "@/lib/utils";
import { Heart } from "@phosphor-icons/react";

// Coracao Phosphor. liked=true: preenchido em vermelho (#ef4444); liked=false:
// contorno na cor herdada.
export function HeartIcon({ liked = false, className = "", ...props }) {
  return (
    <Heart
      weight={liked ? "fill" : "regular"}
      color={liked ? "#ef4444" : "currentColor"}
      className={cn("shrink-0", className)}
      {...props}
    />
  );
}
