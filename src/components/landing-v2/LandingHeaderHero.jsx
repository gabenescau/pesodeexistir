import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Menu, Moon, Sun, X } from "@/lib/icons";
import { useAuth } from "@/app/data/AuthContext";
import { useTheme } from "@/components/theme-provider";

const links = [
  { label: "Biblioteca", href: "#biblioteca" },
  { label: "Comunidade", href: "#sobre" },
  { label: "Autores", href: "#autores" },
  { label: "Recursos", href: "#recursos" },
  { label: "Depoimentos", href: "#depoimentos" },
  { label: "Planos", href: "#planos" },
];

export function LandingHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { theme, toggle } = useTheme();
  const { isAuthenticated } = useAuth();
  const destination = isAuthenticated ? "/app/inicio" : "/entrar";

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-6 sm:pt-4">
      <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between rounded-[8px] border border-[var(--landing-border)] bg-[var(--landing-bg-glass)] px-4 py-3 backdrop-blur-xl sm:px-6">
        <a href="#top" className="font-serif text-[15px] leading-[0.9] text-[var(--landing-fg)] sm:text-[17px]">
          OPE
          <br />
          CLUB
        </a>

        <nav className="hidden items-center gap-7 lg:flex" aria-label="Navegação principal">
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--landing-muted)] transition-colors hover:text-[var(--landing-fg)]"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Alternar tema"
            onClick={toggle}
            className="flex size-10 items-center justify-center rounded-full border border-[var(--landing-border)] text-[var(--landing-muted)] transition-colors hover:text-[var(--landing-fg)]"
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
          <Link
            to={destination}
            className="hidden rounded-full bg-[var(--landing-brand)] px-5 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-white transition-opacity hover:opacity-90 sm:inline-flex"
          >
            {isAuthenticated ? "Acessar" : "Assinar"}
          </Link>
          <button
            type="button"
            aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((current) => !current)}
            className="flex size-10 items-center justify-center rounded-full border border-[var(--landing-border)] text-[var(--landing-fg)] lg:hidden"
          >
            {menuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="mx-auto mt-2 grid w-full max-w-[1400px] gap-1 rounded-[8px] border border-[var(--landing-border)] bg-[var(--landing-surface)] p-3 lg:hidden" aria-label="Navegação mobile">
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="flex min-h-11 items-center rounded-[6px] px-3 text-sm text-[var(--landing-fg)] hover:bg-[var(--landing-hover)]"
            >
              {link.label}
            </a>
          ))}
          <Link
            to={destination}
            onClick={() => setMenuOpen(false)}
            className="mt-2 flex min-h-11 items-center justify-center rounded-full bg-[var(--landing-brand)] px-5 text-sm font-semibold text-white"
          >
            {isAuthenticated ? "Entrar no aplicativo" : "Assinar OPE Club"}
          </Link>
        </nav>
      )}
    </header>
  );
}

export function LandingHero() {
  return (
    <section id="top" className="relative isolate min-h-[92svh] overflow-hidden bg-[var(--landing-bg)]">
      <div aria-hidden className="absolute inset-0 -z-20 bg-[url('/hero/backgroundclaromobile.png')] bg-[length:116%_auto] bg-[position:center_-18vw] bg-no-repeat dark:bg-[url('/hero/backgroundherocelular.png')] md:bg-[url('/hero/versaoclaradesktop.png')] md:bg-cover md:bg-center dark:md:bg-[url('/hero/backgroundnovo.png')]" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--landing-bg)_55%,transparent)_0%,color-mix(in_srgb,var(--landing-bg)_30%,transparent)_40%,transparent_72%)] md:bg-[linear-gradient(90deg,var(--landing-bg)_0%,color-mix(in_srgb,var(--landing-bg)_88%,transparent)_28%,color-mix(in_srgb,var(--landing-bg)_30%,transparent)_58%,transparent_82%)]" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-32 bg-gradient-to-t from-[var(--landing-section)] to-transparent" />

      <div className="mx-auto flex min-h-[92svh] w-full max-w-[1500px] items-end px-5 pb-10 pt-[82vw] sm:px-8 sm:pt-[68vw] md:items-center md:px-10 md:pb-12 md:pt-28 lg:px-12">
        <div className="w-full max-w-[620px]">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.38em] text-[var(--landing-brand)]">
            OPE Club
          </span>
          <h1 className="mt-5 max-w-[620px] font-serif text-[clamp(2.35rem,7vw,4.25rem)] font-normal leading-[1.04] text-[var(--landing-fg)]">
            O lugar onde quem ama <span className="text-[var(--landing-brand)]">filosofia</span> e{" "}
            <span className="text-[var(--landing-brand)]">literatura</span> se encontra.
          </h1>
          <p className="mt-5 max-w-[560px] text-[14px] leading-6 text-[var(--landing-muted)] md:text-[15px]">
            Leia os maiores filósofos e escritores da história, participe de discussões,
            compartilhe suas ideias e descubra novas perspectivas dentro de um aplicativo
            criado exclusivamente para leitores.
          </p>
          <Link
            to="/entrar"
            className="group mt-8 inline-flex min-h-14 w-full max-w-[290px] items-center justify-between gap-6 rounded-[8px] border border-[var(--landing-brand)]/40 bg-[linear-gradient(110deg,var(--landing-brand-strong),var(--landing-brand))] px-6 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-white transition-opacity hover:opacity-90"
          >
            Assinar OPE Club
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </section>
  );
}
