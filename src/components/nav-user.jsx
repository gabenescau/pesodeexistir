import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { LogOut, Settings, User } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import { useAuth } from "@/app/data/AuthContext";

export function NavUser() {
  const { user, profile, logout } = useAuth();
  const navigate = useNavigate();
  const [imageBroken, setImageBroken] = useState(false);
  const [open, setOpen] = useState(false);

  const name = profile?.name || user?.user_metadata?.name || user?.email?.split("@")[0] || "Usuário";
  const avatar = imageBroken ? null : profile?.avatar || user?.user_metadata?.avatar_url;
  const initial = name.charAt(0).toUpperCase();

  function go(path) {
    setOpen(false);
    navigate(path);
  }

  async function handleLogout() {
    setOpen(false);
    await logout();
    navigate("/entrar", { replace: true });
  }

  return (
    <div className="relative">
      <button
        aria-label="Abrir menu da conta"
        aria-expanded={open}
        className="cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-mint)]"
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <Avatar className="size-8">
          {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" onError={() => setImageBroken(true)} /> : null}
          <AvatarFallback className="bg-[var(--accent-mint)]/10 text-[var(--accent-mint)]">{initial}</AvatarFallback>
        </Avatar>
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-1 shadow-[0_18px_45px_rgba(0,0,0,.24)]">
            <div className="border-b border-[var(--border)] px-3 py-2.5">
              <p className="truncate text-sm font-medium text-[var(--text-primary)]">{name}</p>
              {user?.email && <p className="truncate text-xs text-[var(--text-muted)]">{user.email}</p>}
            </div>
            <button
              type="button"
              onClick={() => go("/app/perfil")}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)]"
            >
              <User className="size-4" /> Meu perfil
            </button>
            <button
              type="button"
              onClick={() => go("/app/configuracoes")}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)]"
            >
              <Settings className="size-4" /> Configurações
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-400 transition-colors hover:bg-red-500/10"
            >
              <LogOut className="size-4" /> Sair da conta
            </button>
          </div>
        </>
      )}
    </div>
  );
}
