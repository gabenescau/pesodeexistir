import { Link } from "react-router-dom";
import { MobileNav } from "@/components/mobile-nav";
import { Logo } from "@/components/logo";
import { useTheme } from "@/components/theme-provider";
import { MoonIcon, SunIcon } from "lucide-react";

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

  return (
    <header className="landing-header absolute inset-x-0 top-0 z-50 px-4 pt-4 sm:px-6 lg:px-8">
      <nav className="mx-auto flex h-16 w-full max-w-[1500px] items-center justify-between rounded-full bg-[#080706]/72 px-5 shadow-[0_18px_80px_rgba(0,0,0,.34)] backdrop-blur-xl sm:h-18 sm:px-7">
        <Link className="flex min-w-[112px] items-center text-[#f4eee6]" to="/">
          <Logo className="text-[26px] sm:text-[31px]" />
        </Link>

        <div className="hidden flex-1 items-center justify-center md:flex">
          <div className="flex items-center gap-7 lg:gap-10 xl:gap-12">
            {navLinks.map((link) => (
              <a
                key={link.label}
                className="text-[11px] font-[500] uppercase tracking-[0.28em] text-[#e8ded2]/70 transition-colors hover:text-[#d38b5f] lg:text-[12px]"
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
            className="flex size-9 items-center justify-center rounded-full border border-[#c78359]/25 text-[#d8cfc3] transition hover:bg-[#c78359]/10 hover:text-[#c78359]"
            onClick={toggle}
            type="button"
          >
            {theme === "dark" ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
          </button>
          <Link
            className="rounded-full bg-[#d08a5d] px-5 py-2.5 text-[11px] font-[600] uppercase tracking-[0.2em] text-[#090705] transition hover:bg-[#e1a073]"
            to="/entrar"
          >
            Assinar
          </Link>
        </div>
        <MobileNav />
      </nav>
    </header>
  );
}
