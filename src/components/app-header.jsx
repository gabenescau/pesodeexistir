import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { CustomSidebarTrigger } from "@/components/custom-sidebar-trigger";
import { NavUser } from "@/components/nav-user";
import { BellIcon, SunIcon, MoonIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";

const pathLabels = {
  "/app/inicio": "Início",
  "/app/comunidade": "Comunidade",
  "/app/biblioteca": "Biblioteca",
  "/app/explorar": "Explorar",
  "/app/perfil": "Perfil",
  "/app/configuracoes": "Configurações",
};

export function AppHeader() {
  const location = useLocation();
  const currentLabel = pathLabels[location.pathname] || "";
  const { theme, toggle } = useTheme();
  const [notifOpen, setNotifOpen] = useState(false);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 flex h-14 shrink-0 items-center justify-between gap-2 px-4 md:px-6",
        "bg-[var(--bg-card)]/95 backdrop-blur-sm"
      )}
    >
      <div className="flex items-center gap-3">
        <CustomSidebarTrigger />
        <Separator className="mr-2 h-4" orientation="vertical" />
        <nav className="flex items-center gap-1.5 text-sm" style={{ color: "var(--text-secondary)" }}>
          <Link to="/app/inicio" className="hover:text-[var(--text-primary)] transition-colors">App</Link>
          {currentLabel && (
            <>
              <span style={{ color: "var(--border-strong)" }}>/</span>
              <span style={{ color: "var(--text-primary)" }}>{currentLabel}</span>
            </>
          )}
        </nav>
      </div>
      <div className="flex items-center gap-2">
        <Button
          aria-label="Tema"
          size="icon-sm"
          variant="ghost"
          onClick={toggle}
          className="hover:bg-[var(--hover-overlay)]"
        >
          {theme === "dark" ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
        </Button>
        <div className="relative">
          <Button
            aria-label="Notificações"
            size="icon-sm"
            variant="ghost"
            className="hover:bg-[var(--hover-overlay)]"
            onClick={() => setNotifOpen(!notifOpen)}
          >
            <BellIcon className="size-4" />
          </Button>
          {notifOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-72 z-50 rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] shadow-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-[var(--border)]">
                  <p className="text-sm font-medium text-[var(--text-primary)]">Notificações</p>
                </div>
                <div className="p-4 text-center">
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>Nenhuma notificação</p>
                </div>
              </div>
            </>
          )}
        </div>
        <Separator className="h-4" orientation="vertical" />
        <NavUser />
      </div>
    </header>
  );
}
