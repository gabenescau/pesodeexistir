import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";
import { useScroll } from "@/hooks/use-scroll";
import { Button } from "@/components/ui/button";
import { MobileNav } from "@/components/mobile-nav";

export const navLinks = [
  { label: "Acervo", href: "#acervo" },
  { label: "Comunidade", href: "#comunidade" },
  { label: "Planos", href: "#planos" },
  { label: "FAQ", href: "#faq" },
];

export function Header() {
  const scrolled = useScroll(10);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 mx-auto w-full",
        scrolled && "bg-[var(--kvn-bg)]/90 backdrop-blur-xl supports-backdrop-filter:bg-[var(--kvn-bg)]/70",
      )}
    >
      <nav className="flex h-14 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 mx-auto">
        <Link className="flex items-center gap-2 rounded-full px-2 py-2 hover:bg-white/6" to="/">
          <Logo className="h-4 w-auto" />
          <span className="font-bold text-sm tracking-tight text-[var(--kvn-fg)]">OPE Club</span>
        </Link>
        <div className="hidden flex-1 items-center justify-end gap-3 md:flex">
          <div className="flex items-center gap-1 rounded-full bg-white/[0.04] p-1">
            {navLinks.map((link) => (
              <Button
                key={link.label}
                size="sm"
                variant="ghost"
                className="rounded-full px-3 text-[var(--kvn-muted)] hover:bg-white/[0.08] hover:text-[var(--kvn-fg)]"
                render={<a href={link.href} />}
                nativeButton={false}
              >
                {link.label}
              </Button>
            ))}
          </div>
          <Button
            size="sm"
            variant="outline"
            className="rounded-full border-[var(--kvn-brand)]/40 text-[var(--kvn-brand)] hover:bg-[var(--kvn-brand)]/10"
            render={<Link to="/entrar" />}
            nativeButton={false}
          >
            Entrar
          </Button>
        </div>
        <MobileNav />
      </nav>
    </header>
  );
}
