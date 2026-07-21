import { useNavigate } from "react-router-dom";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserIcon, SettingsIcon, LogOutIcon } from "lucide-react";
import { useAuth } from "@/app/data/AuthContext";

export function NavUser() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const name = user?.user_metadata?.name || user?.email?.split("@")[0] || "Usuário";
  const email = user?.email || "";
  const initial = name.charAt(0).toUpperCase();

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="cursor-pointer" nativeButton={true}>
        <Avatar className="size-8">
          <AvatarFallback className="bg-[var(--accent-mint)]/10 text-[var(--accent-mint)]">{initial}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex items-center gap-3 p-2">
          <Avatar className="size-10">
            <AvatarFallback className="bg-[var(--accent-mint)]/10 text-[var(--accent-mint)]">{initial}</AvatarFallback>
          </Avatar>
          <div>
            <div className="font-medium text-foreground">{name}</div>
            <div className="max-w-full overflow-hidden overflow-ellipsis whitespace-nowrap text-muted-foreground text-xs">
              {email}
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem render={<a href="/app/perfil" onClick={(e) => { e.preventDefault(); navigate("/app/perfil"); }} />}>
            <UserIcon />
            Perfil
          </DropdownMenuItem>
          <DropdownMenuItem render={<a href="/app/configuracoes" onClick={(e) => { e.preventDefault(); navigate("/app/configuracoes"); }} />}>
            <SettingsIcon />
            Configurações
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem className="w-full cursor-pointer" variant="destructive" onClick={handleLogout}>
            <LogOutIcon />
            Sair
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
