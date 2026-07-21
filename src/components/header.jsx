"use client";
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
        "sticky top-0 z-50 mx-auto w-full max-w-4xl border-transparent border-b md:rounded-md md:border md:transition-all md:ease-out",
        scrolled && "border-border bg-background/95 backdrop-blur-sm supports-backdrop-filter:bg-background/50 md:top-2 md:max-w-3xl md:shadow",
      )}
    >
      <nav
        className={cn(
          "flex h-14 w-full items-center justify-between px-4 md:h-12 md:transition-all md:ease-out",
          scrolled && "md:px-2",
        )}
      >
        <Link className="rounded-md p-2 hover:bg-muted" to="/">
          <Logo className="h-4" />
        </Link>
        <div className="hidden items-center gap-2 md:flex">
          <div>
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
            className="rounded-full border-green-600/30 text-green-600 hover:bg-green-600/10"
            render={<Link to="/entrar" />}
            nativeButton={false}
          >
            Entrar
          </Button>
          <Button
            size="sm"
            className="rounded-full bg-green-600 text-white hover:bg-green-700"
            render={<Link to="/entrar" />}
            nativeButton={false}
          >
            Assinar
          </Button>
        </div>
        <MobileNav />
      </nav>
    </header>
  );
}
