import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Menu, Moon, Sun, X } from "@/lib/icons";
import { useAuth } from "@/app/data/AuthContext";
import { useTheme } from "@/components/theme-provider";
import { Logo } from "@/components/logo";

const links = [
  { label: "Ecossistema", href: "#ecossistema" },
  { label: "Biblioteca", href: "#biblioteca" },
  { label: "Loja & XP", href: "#loja-xp" },
  { label: "Autores", href: "#autores" },
  { label: "Manifesto", href: "#sobre" },
  { label: "Planos", href: "#planos" },
];

export function LandingHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { theme, toggle } = useTheme();
  const { isAuthenticated } = useAuth();
  const destination = isAuthenticated ? "/app/inicio" : "/entrar";

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-6 sm:pt-4">
      <div className="mx-auto flex w-full max-w-[1340px] items-center justify-between rounded-2xl border border-[var(--landing-border)] bg-[var(--landing-bg-glass)] px-4 py-3 backdrop-blur-xl shadow-lg sm:px-6 sm:py-3.5">
        <a href="#top" className="flex items-center text-[var(--landing-fg)] transition-opacity hover:opacity-80">
          <Logo className="text-[17px] sm:text-[19px] leading-[0.88]" />
        </a>

        <nav className="hidden items-center gap-8 lg:flex" aria-label="Navegação principal">
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-[13px] font-medium text-[var(--landing-muted)] transition-colors hover:text-[var(--landing-fg)]"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-2.5">
          <button
            type="button"
            aria-label="Alternar tema"
            onClick={toggle}
            className="flex size-9 items-center justify-center rounded-xl border border-[var(--landing-border)] text-[var(--landing-muted)] transition-colors hover:text-[var(--landing-fg)] hover:bg-[var(--landing-hover)]"
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
          
          <Link
            to="/entrar"
            className="hidden items-center rounded-xl border border-[var(--landing-border)] px-4 py-2 text-xs font-medium text-[var(--landing-fg)] transition-all hover:bg-[var(--landing-hover)] sm:inline-flex"
          >
            Entrar
          </Link>

          <Link
            to={destination}
            className="hidden rounded-xl bg-[var(--landing-brand)] px-5 py-2 text-xs font-semibold text-[var(--landing-brand-fg)] transition-all hover:brightness-95 sm:inline-flex shadow-sm"
          >
            {isAuthenticated ? "Abrir App" : "Assinar Clube"}
          </Link>

          <button
            type="button"
            aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((current) => !current)}
            className="flex size-9 items-center justify-center rounded-xl border border-[var(--landing-border)] text-[var(--landing-fg)] lg:hidden"
          >
            {menuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="mx-auto mt-2 grid w-full max-w-[1340px] gap-1 rounded-2xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-3.5 shadow-2xl backdrop-blur-2xl lg:hidden" aria-label="Navegação mobile">
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="flex min-h-11 items-center rounded-xl px-3.5 text-sm text-[var(--landing-fg)] hover:bg-[var(--landing-hover)] font-medium transition-colors"
            >
              {link.label}
            </a>
          ))}
          <div className="mt-2 grid grid-cols-2 gap-2 pt-2.5 border-t border-[var(--landing-border)]">
            <Link
              to="/entrar"
              onClick={() => setMenuOpen(false)}
              className="flex min-h-11 items-center justify-center rounded-xl border border-[var(--landing-border)] px-4 text-xs font-medium text-[var(--landing-fg)] hover:bg-[var(--landing-hover)]"
            >
              Entrar
            </Link>
            <Link
              to={destination}
              onClick={() => setMenuOpen(false)}
              className="flex min-h-11 items-center justify-center rounded-xl bg-[var(--landing-brand)] px-4 text-xs font-semibold text-[var(--landing-brand-fg)] hover:brightness-95"
            >
              {isAuthenticated ? "Abrir App" : "Assinar"}
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}

export function LandingHero() {
  return (
    <section id="top" className="relative isolate min-h-[92svh] overflow-hidden bg-[var(--landing-bg)]">
      {/* Background artwork */}
      <div
        aria-hidden
        className="absolute inset-0 -z-20 bg-[url('/hero/backgroundclaromobile.png')] bg-[length:100%_auto] bg-top bg-no-repeat dark:bg-[url('/hero/backgroundherocelular.png')] md:bg-[url('/hero/versaoclaradesktop.png')] md:bg-cover md:bg-center dark:md:bg-[url('/hero/backgroundnovo.png')]"
      />
      
      {/* Section transition & contrast gradient for both mobile and desktop */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,transparent_0%,color-mix(in_srgb,var(--landing-bg)_40%,transparent)_35%,color-mix(in_srgb,var(--landing-section)_85%,transparent)_65%,var(--landing-section)_100%)] md:bg-[linear-gradient(90deg,var(--landing-bg)_0%,color-mix(in_srgb,var(--landing-bg)_90%,transparent)_30%,color-mix(in_srgb,var(--landing-bg)_35%,transparent)_60%,transparent_85%)]"
      />
      
      {/* Smooth fade-out to next section */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 -z-10 h-44 sm:h-56 md:h-72 bg-gradient-to-t from-[var(--landing-section)] via-[var(--landing-section)]/85 to-transparent pointer-events-none"
      />

      <div className="mx-auto flex min-h-[92svh] w-full max-w-[1400px] items-end px-5 pb-12 pt-[82vw] sm:px-8 sm:pt-[70vw] md:items-center md:px-10 md:pb-16 md:pt-32 lg:px-12">
        <div className="w-full max-w-[680px]">
          <h1 className="max-w-[640px] text-[clamp(2.1rem,6vw,4.2rem)] font-semibold leading-[1.06] tracking-tight text-[var(--landing-fg)] text-balance">
            O ecossistema definitivo para quem ama <span className="text-[var(--landing-brand)]">filosofia</span> e{" "}
            <span className="text-[var(--landing-brand)]">literatura</span>.
          </h1>

          <div className="mt-7 sm:mt-9 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
            <Link
              to="/entrar"
              className="group inline-flex min-h-12 sm:min-h-13 items-center justify-center gap-2.5 sm:gap-3 rounded-xl bg-[var(--landing-brand)] px-7 sm:px-8 text-xs sm:text-sm font-semibold text-[var(--landing-brand-fg)] transition-all hover:brightness-95 shadow-md text-center"
            >
              <span>Assinar OPE Club</span>
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href="#ecossistema"
              className="inline-flex min-h-12 sm:min-h-13 items-center justify-center rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] px-6 text-xs sm:text-sm font-medium text-[var(--landing-fg)] transition-colors hover:border-[var(--landing-brand)]/50 hover:bg-[var(--landing-hover)] text-center"
            >
              Conhecer o ecossistema
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
