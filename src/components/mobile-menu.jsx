import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";
import { MenuIcon, XIcon, LogOut } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useAuth } from "@/app/data/AuthContext";
import { useNavGroups, adminGroup } from "@/components/app-shared";

export function MobileMenu() {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { canManageContent, logout } = useAuth();
  const dynamicNavGroups = useNavGroups();
  const groups = canManageContent ? [...dynamicNavGroups, adminGroup] : dynamicNavGroups;

  function isActive(item) {
    return location.pathname === item.match || location.pathname.startsWith(item.match + "/");
  }

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
    <Sheet open={open} onOpenChange={setOpen}>
      <Button
        aria-label="Abrir menu"
        size="icon-sm"
        variant="ghost"
        onClick={() => setOpen(true)}
        className="hover:bg-[var(--hover-overlay)] xl:hidden"
      >
        <MenuIcon className="size-4" />
      </Button>

      <SheetContent side="left" showCloseButton={false} className="w-[min(85vw,20rem)]">
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between px-4 py-3">
              <Link to="/app/inicio" onClick={() => setOpen(false)} aria-label="Ir para o inicio">
                <Logo className="text-[20px] text-[var(--text-primary)]" />
              </Link>
              <Button
                aria-label="Fechar menu"
                variant="ghost"
                size="icon-sm"
                onClick={() => setOpen(false)}
                className="hover:bg-[var(--hover-overlay)]"
              >
                <XIcon className="size-4" />
              </Button>
            </div>

<div className="flex-1 overflow-y-auto px-2 pb-4">
              {groups.map((group) => (
                <div key={group.label} className="mb-4">
                  <p className="px-3 pb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    {group.label}
                  </p>
                  <div className="space-y-0.5">
                    {group.items.map((item) =>
                      item.subItems?.length ? (
                        <div key={item.title}>
                          <SheetItem title={item.title} icon={item.icon} active={isActive(item)} onClick={() => go(item.path)} />
                          <div className="ml-3 border-l border-[var(--border)] pl-2">
                            {item.subItems.map((sub) => (
                              <SheetItem
                                key={sub.title}
                                title={sub.title}
                                icon={sub.icon}
                                active={isActive(sub)}
                                onClick={() => go(sub.path)}
                                indent
                              />
                            ))}
                          </div>
                        </div>
                      ) : (
                        <SheetItem
                          key={item.title}
                          title={item.title}
                          icon={item.icon}
                          active={isActive(item)}
                          onClick={() => go(item.path)}
                        />
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-[var(--border)] p-2">
              <SheetItem title="Meu perfil" active={location.pathname === "/app/perfil"} onClick={() => go("/app/perfil")} />
              <SheetItem title="Conta" active={location.pathname === "/app/configuracoes"} onClick={() => go("/app/configuracoes")} />
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-sm text-red-400 transition-colors hover:bg-red-500/10"
              >
                <LogOut className="size-4" />
                Sair da conta
              </button>
            </div>
          </div>
        </SheetContent>
    </Sheet>
  );
}

function SheetItem({ title, icon, active, onClick, indent }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-11 w-full items-center gap-2.5 rounded-[8px] px-3 py-2 text-left text-sm transition-colors",
        indent ? "pl-5" : "",
        active
          ? "bg-[var(--accent-mint)]/10 font-semibold text-[var(--accent-mint)]"
          : "text-[var(--text-secondary)] font-medium hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)]"
      )}
    >
      {icon ? <span className="grid size-4 shrink-0 place-items-center text-current [&>svg]:size-4">{icon}</span> : null}
      <span className="truncate">{title}</span>
    </button>
  );
}
