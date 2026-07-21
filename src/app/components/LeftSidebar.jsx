import { useAuth } from "@/app/data/AuthContext";
import { Home, MessageCircle, Library, Compass, Users, Calendar, Mail, Bell, User, Settings } from "lucide-react";

const navItems = [
  { id: "home", label: "Início", icon: Home },
  { id: "community", label: "Comunidade", icon: MessageCircle },
  { id: "library", label: "Biblioteca", icon: Library },
  { id: "explore", label: "Explorar", icon: Compass },
  { id: "clubs", label: "Clubes", icon: Users },
  { id: "events", label: "Eventos", icon: Calendar },
  { id: "messages", label: "Mensagens", icon: Mail },
  { id: "notifications", label: "Notificações", icon: Bell },
  { id: "profile", label: "Perfil", icon: User },
  { id: "settings", label: "Configurações", icon: Settings },
];

export function LeftSidebar({ activePage, onNavigate }) {
  const { user } = useAuth();
  const name = user?.user_metadata?.name || user?.email?.split("@")[0] || "Usuário";
  const initial = name.charAt(0).toUpperCase();

  return (
    <aside className="hidden lg:flex w-[260px] shrink-0 flex-col h-screen sticky top-0 border-r border-[var(--border)] bg-[var(--bg-card)]">
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center gap-2.5">
          <span className="text-lg font-bold tracking-tight text-[var(--text-primary)]">OPE</span>
          <span className="text-lg font-medium tracking-tight text-[var(--text-secondary)]">Club</span>
        </div>
      </div>

      <nav className="flex-1 px-3 py-2 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activePage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${
                active
                  ? "bg-[var(--text-primary)]/10 text-[var(--text-primary)] font-medium"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-overlay)]"
              }`}
            >
              <Icon className="size-[18px]" strokeWidth={active ? 2 : 1.5} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-[var(--border)]">
        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[var(--hover-overlay)] transition-colors">
          <div className="size-8 rounded-xl bg-[var(--hover-overlay)] flex items-center justify-center text-sm font-bold text-[var(--text-primary)]">
            {initial}
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-[var(--text-primary)]">{name}</p>
            <p className="text-xs text-[var(--text-muted)]">ver perfil</p>
          </div>
        </button>
      </div>
    </aside>
  );
}
