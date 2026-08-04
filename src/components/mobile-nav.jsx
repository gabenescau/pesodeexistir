import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Portal } from "@/components/portal";
import { navLinks } from "@/components/header";
import { Logo } from "@/components/logo";
import { useTheme } from "@/components/theme-provider";
import { useAuth } from "@/app/data/AuthContext";
import { XIcon, MenuIcon, ArrowRightIcon, MoonIcon, SunIcon } from "@/lib/icons";

export function MobileNav() {
  const [open, setOpen] = React.useState(false);
  const { theme, toggle } = useTheme();
  const { isAuthenticated } = useAuth();
  const ctaLabel = isAuthenticated ? "Acessar" : "Assinar";
  const ctaTo = isAuthenticated ? "/app/inicio" : "/entrar";

  React.useEffect(() => {
    document.documentElement.classList.toggle("mobile-menu-open", open);
    return () => document.documentElement.classList.remove("mobile-menu-open");
  }, [open]);

  return (
    <div className="md:hidden">
      <Button
        aria-controls="mobile-menu"
        aria-expanded={open}
        aria-label={open ? "Fechar menu" : "Abrir menu"}
        className="mobile-menu-trigger size-10 rounded-full! border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-none! hover:bg-[var(--bg-card-hover)]"
        onClick={() => setOpen(!open)}
        size="icon"
        variant="outline"
      >
        {open ? <XIcon className="size-4.5" /> : <MenuIcon className="size-4.5" />}
      </Button>

      {open && (
        <Portal id="mobile-menu">
          <div className="mobile-menu-panel fixed inset-0 z-[90] bg-[var(--bg-canvas)]/96 backdrop-blur-xl">
            <div
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_70%_0%,var(--accent-mint)/22,transparent_45%)]"
            />
            <div className="relative flex min-h-dvh flex-col px-5 pb-6 pt-5">
              <div className="flex items-center justify-between">
                <Link
                  className="mobile-menu-logo text-[var(--text-primary)]"
                  to="/"
                  onClick={() => setOpen(false)}
                >
                  <Logo className="text-[30px]" />
                </Link>
                <div className="flex items-center gap-2">
                  <button
                    aria-label="Alternar modo claro e escuro"
                    className="mobile-menu-icon flex size-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)]"
                    onClick={toggle}
                    type="button"
                  >
                    {theme === "dark" ? <SunIcon className="size-4.5" /> : <MoonIcon className="size-4.5" />}
                  </button>
                  <button
                    aria-label="Fechar menu"
                    className="mobile-menu-icon flex size-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)]"
                    onClick={() => setOpen(false)}
                    type="button"
                  >
                    <XIcon className="size-4.5" />
                  </button>
                </div>
              </div>

              <nav className="mt-12 grid gap-1">
                {navLinks.map((link) => (
                  <a
                    className="mobile-menu-link group flex items-center justify-between border-b border-[var(--border)] py-4 text-[13px] font-[500] uppercase tracking-[0.26em] text-[var(--text-secondary)] transition-colors hover:text-[var(--accent-mint)]"
                    href={link.href}
                    key={link.label}
                    onClick={() => setOpen(false)}
                  >
                    {link.label}
                    <ArrowRightIcon className="size-4 text-[var(--accent-mint)] opacity-70 transition-transform group-hover:translate-x-1" />
                  </a>
                ))}
              </nav>

              <div className="mt-auto grid gap-3 pt-10">
                <Link
                  className="mobile-menu-ghost flex h-12 items-center justify-center rounded-full border border-[var(--border)] text-[12px] font-[600] uppercase tracking-[0.22em] text-[var(--text-secondary)]"
                  onClick={() => setOpen(false)}
                  to={isAuthenticated ? "/app/inicio" : "/entrar"}
                >
                  {isAuthenticated ? "Ir para o app" : "Entrar"}
                </Link>
                <Link
                  className="mobile-menu-cta flex h-12 items-center justify-center rounded-full bg-[var(--accent-mint)] text-[12px] font-[700] uppercase tracking-[0.22em] text-white"
                  onClick={() => setOpen(false)}
                  to={ctaTo}
                >
                  {ctaLabel}
                </Link>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
