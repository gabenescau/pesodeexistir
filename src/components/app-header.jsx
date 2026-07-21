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
        <Button
          aria-label="Notificações"
          size="icon-sm"
          variant="ghost"
          className="hover:bg-[var(--hover-overlay)]"
        >
          <BellIcon className="size-4" />
        </Button>
        <Separator className="h-4" orientation="vertical" />
        <NavUser />
      </div>
    </header>
  );
}
