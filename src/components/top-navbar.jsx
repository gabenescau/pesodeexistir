import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";
import { NavUser } from "@/components/nav-user";
import { BellIcon, ChevronRightIcon, MoonIcon, SunIcon } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
import { useAuth } from "@/app/data/AuthContext";
import { useData } from "@/app/data/DataContext";
import { useNavGroups, adminGroup } from "@/components/app-shared";

function NavDropdown({ label, to, active, subItems }) {
  const navigate = useNavigate();
  const ref = useRef(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(event) {
      if (event.key === "Escape") setOpen(false);
    }
    function onPointerDown(event) {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  function go(path) {
    setOpen(false);
    navigate(path);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className={cn(
          "flex items-center gap-1 rounded-full px-3 py-2 text-sm font-medium transition-colors",
          active
            ? "bg-[var(--text-primary)]/10 text-[var(--text-primary)]"
            : "text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)]"
        )}
      >
        {label}
        <ChevronRightIcon className={cn("size-3.5 transition-transform", open && "rotate-90")} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-[70vh] min-w-52 overflow-y-auto rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-1.5 shadow-[0_18px_45px_rgba(0,0,0,.24)]">
          <button
            type="button"
            onClick={() => go(to)}
            className="flex w-full items-center gap-2 rounded-[8px] px-3 py-2 text-left text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--hover-overlay)]"
          >
            Ver tudo
          </button>
          <div className="my-1 h-px bg-[var(--border)]" />
          {subItems.map((sub) => (
            <button
              key={`${sub.to}-${sub.title}`}
              type="button"
              onClick={() => go(sub.to)}
              className="flex w-full items-center gap-2 rounded-[8px] px-3 py-2 text-left text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)]"
            >
              <span className="truncate">{sub.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function TopNavbar() {
  const location = useLocation();
  const { theme, toggle } = useTheme();
  const { canManageContent } = useAuth();
  const { books, categories } = useData();
  const [notifOpen, setNotifOpen] = useState(false);
  const dynamicNavGroups = useNavGroups();
  const groups = canManageContent ? [...dynamicNavGroups, adminGroup] : dynamicNavGroups;
  const items = groups.flatMap((group) => group.items);

  const categorias = useMemo(() => {
    const setNomes = new Set(categories.map((c) => c.name));
    books.forEach((b) => { if (b.category) setNomes.add(b.category); });
    return [...setNomes].sort((a, b) => a.localeCompare(b, "pt"));
  }, [categories, books]);

  function isActive(item) {
    return location.pathname === item.match || location.pathname.startsWith(item.match + "/");
  }

  function renderItem(item) {
    if (item.title === "Biblioteca" || item.title === "Explorar") {
      const subItems = categorias.map((cat) => ({
        title: cat,
        to: `${item.path}?categoria=${encodeURIComponent(cat)}`,
      }));
      return (
        <NavDropdown
          key={item.title}
          label={item.title}
          to={item.path}
          active={isActive(item)}
          subItems={subItems}
        />
      );
    }

    if (item.subItems?.length) {
      const subItems = item.subItems.map((sub) => ({ title: sub.title, to: sub.path }));
      return (
        <NavDropdown
          key={item.title}
          label={item.title}
          to={item.path}
          active={isActive(item)}
          subItems={subItems}
        />
      );
    }

    return (
      <Link
        key={item.title}
        to={item.path}
        className={cn(
          "rounded-full px-3 py-2 text-sm font-medium transition-colors",
          isActive(item)
            ? "bg-[var(--text-primary)]/10 text-[var(--text-primary)]"
            : "text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)]"
        )}
      >
        {item.title}
      </Link>
    );
  }

  return (
    <header className="sticky top-0 z-50 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--bg-card)]/95 px-4 backdrop-blur-sm md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Link to="/app/inicio" aria-label="Ir para o inicio" className="shrink-0">
          <Logo className="text-[20px] text-[var(--text-primary)]" />
        </Link>

        <nav className="hidden min-w-0 items-center gap-0.5 md:flex">
          {items.map((item) => renderItem(item))}
        </nav>
      </div>

      <div className="flex shrink-0 items-center gap-2">
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
            aria-label="Notificacoes"
            size="icon-sm"
            variant="ghost"
            className="hover:bg-[var(--hover-overlay)]"
            onClick={() => setNotifOpen((value) => !value)}
          >
            <BellIcon className="size-4" />
          </Button>
          {notifOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
              <div className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] shadow-[0_18px_45px_rgba(0,0,0,.24)]">
                <div className="border-b border-[var(--border)] px-4 py-3">
                  <p className="text-sm font-medium text-[var(--text-primary)]">Notificacoes</p>
                </div>
                <div className="p-4 text-center">
                  <p className="text-sm text-[var(--text-muted)]">Nenhuma notificacao</p>
                </div>
              </div>
            </>
          )}
        </div>
        <NavUser />
      </div>
    </header>
  );
}
