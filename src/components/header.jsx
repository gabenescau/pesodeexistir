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
        "sticky top-0 z-50 mx-auto w-full max-w-7xl border-transparent border-b px-4 transition-all ease-out sm:px-6 lg:px-8",
        scrolled && "bg-background/90 backdrop-blur-xl supports-backdrop-filter:bg-background/70",
      )}
    >
      <nav
        className={cn(
          "flex h-16 w-full items-center justify-between gap-4 md:h-18",
        )}
      >
        <Link className="flex items-center gap-2 rounded-full px-2 py-2 hover:bg-white/6" to="/">
          <Logo className="h-4 w-auto" />
          <span className="font-bold text-sm tracking-tight text-foreground">OPE Club</span>
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
          <Button size="sm" variant="ghost" className="rounded-full px-4 text-[var(--kvn-fg)] hover:bg-white/[0.08]" render={<Link to="/entrar" />} nativeButton={false}>
            Entrar
          </Button>
          <Button size="sm" className="rounded-full px-5">Assinar</Button>
        </div>
        <MobileNav />
      </nav>
    </header>
  );
}
