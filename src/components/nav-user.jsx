import { useNavigate } from "react-router-dom";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import { useAuth } from "@/app/data/AuthContext";

export function NavUser() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const name = profile?.name || user?.user_metadata?.name || user?.email?.split("@")[0] || "Usuário";
  const avatar = profile?.avatar || user?.user_metadata?.avatar_url;
  const initial = name.charAt(0).toUpperCase();

  return (
    <button
      aria-label="Abrir configurações"
      className="cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-mint)]"
      onClick={() => navigate("/app/configuracoes")}
      type="button"
    >
      <Avatar className="size-8">
        {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : null}
        <AvatarFallback className="bg-[var(--accent-mint)]/10 text-[var(--accent-mint)]">{initial}</AvatarFallback>
      </Avatar>
    </button>
  );
}
