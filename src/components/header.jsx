import { Link } from "react-router-dom";
import { MobileNav } from "@/components/mobile-nav";
import { Logo } from "@/components/logo";
import { useTheme } from "@/components/theme-provider";
import { useAuth } from "@/app/data/AuthContext";
import { MoonIcon, SunIcon } from "@/lib/icons";

export const navLinks = [
  { label: "Biblioteca", href: "#acervo" },
  { label: "Comunidade", href: "#comunidade" },
  { label: "Autores", href: "#autores" },
  { label: "Recursos", href: "#recursos" },
  { label: "Depoimentos", href: "#depoimentos" },
  { label: "Planos", href: "#planos" },
];

export function Header() {
  const { theme, toggle } = useTheme();
  const { isAuthenticated } = useAuth();
  const ctaLabel = isAuthenticated ? "Acessar" : "Assinar";
  const ctaTo = isAuthenticated ? "/app/inicio" : "/entrar";

  return (
    <header className="landing-header absolute inset-x-0 top-0 z-50 px-4 pt-4 sm:px-6 lg:px-8">
      <nav className="mx-auto flex h-16 w-full max-w-[1500px] items-center justify-between rounded-full bg-[#000000]/72 px-5 backdrop-blur-xl sm:h-18 sm:px-7">
        <Link className="flex min-w-[112px] items-center text-[var(--text-primary)]" to="/">
          <Logo className="text-[26px] sm:text-[31px]" />
        </Link>

        <div className="hidden flex-1 items-center justify-center md:flex">
          <div className="flex items-center gap-7 lg:gap-10 xl:gap-12">
            {navLinks.map((link) => (
              <a
                key={link.label}
                className="text-[11px] font-[500] uppercase tracking-[0.28em] text-[var(--text-muted)] transition-colors hover:text-[var(--accent-mint)] lg:text-[12px]"
                href={link.href}
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <button
            aria-label="Alternar modo claro e escuro"
            className="flex size-9 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)] transition hover:bg-[var(--hover-overlay)] hover:text-[var(--accent-mint)]"
            onClick={toggle}
            type="button"
          >
            {theme === "dark" ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
          </button>
          <Link
            className="rounded-full bg-[var(--accent-mint)] px-5 py-2.5 text-[11px] font-[600] uppercase tracking-[0.2em] text-white transition hover:bg-[var(--accent-mint)]"
            to={ctaTo}
          >
            {ctaLabel}
          </Link>
        </div>
        <MobileNav />
      </nav>
    </header>
  );
}
