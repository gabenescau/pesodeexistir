import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ArrowRightIcon } from "lucide-react";

export function HeroSection() {
  return (
    <section>
      <div className="relative flex min-h-[calc(100svh-3.5rem)] flex-col items-center justify-center gap-5 px-5 py-16 sm:min-h-0 md:px-8 md:py-28 lg:py-32">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-1 size-full overflow-hidden"
        >
          <div
            className={cn(
              "absolute -inset-x-20 inset-y-0 z-0 rounded-full",
              "bg-[radial-gradient(ellipse_at_center,theme(--color-foreground/.1),transparent,transparent)]",
              "blur-[50px]"
            )}
          />
          <div className="absolute inset-y-0 left-4 w-px bg-linear-to-b from-transparent via-border to-border md:left-8" />
          <div className="absolute inset-y-0 right-4 w-px bg-linear-to-b from-transparent via-border to-border md:right-8" />
          <div className="absolute inset-y-0 left-8 w-px bg-linear-to-b from-transparent via-border/50 to-border/50 md:left-12" />
          <div className="absolute inset-y-0 right-8 w-px bg-linear-to-b from-transparent via-border/50 to-border/50 md:right-12" />
        </div>

        <span className="font-mono text-[12px] font-[400] text-muted-foreground uppercase tracking-[0.6px] fade-in slide-in-from-bottom-10 animate-in fill-mode-backwards delay-100 duration-500 ease-out">
          OPE Club
        </span>

        <h1
          className={cn(
            "max-w-3xl text-balance text-center text-[clamp(2.25rem,8vw,3rem)] text-foreground font-[600] leading-[1.05] tracking-[-0.05em]",
            "fade-in slide-in-from-bottom-10 animate-in fill-mode-backwards delay-200 duration-500 ease-out"
          )}
        >
          O lugar onde quem ama<br />
          filosofia e literatura<br />
          se encontra.
        </h1>

        <p
          className={cn(
            "text-center text-muted-foreground text-[18px] font-[400] leading-[28px] max-w-2xl",
            "fade-in slide-in-from-bottom-10 animate-in fill-mode-backwards delay-300 duration-500 ease-out"
          )}
        >
          Leia os maiores filósofos e escritores da história, participe de
          discussões, compartilhe suas ideias e descubra novas perspectivas
          dentro de um <strong>aplicativo criado exclusivamente para leitores e
          amantes da filosofia</strong>.
        </p>

        <div className="fade-in slide-in-from-bottom-10 flex w-fit animate-in items-center justify-center gap-3 fill-mode-backwards pt-2 delay-400 duration-500 ease-out">
          <Button
            className="h-12 px-8 text-[16px] font-[500] leading-[24px] rounded-[100px]"
            render={<Link to="/entrar" />}
            nativeButton={false}
          >
            Entrar para o OPE Club{" "}
            <ArrowRightIcon data-icon="inline-end" className="size-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}
