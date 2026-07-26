import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ArrowRightIcon } from "lucide-react";

export function HeroSection() {
  return (
    <section className="ope-hero relative isolate overflow-hidden">
      <div
        aria-hidden="true"
        className="hero-bg absolute inset-0 -z-10 opacity-95"
        style={{ "--hero-bg": "url('/hero/backgroundnovo.png')" }}
      />
      <div
        aria-hidden="true"
        className="hero-dark-wash absolute inset-0 -z-10 bg-[linear-gradient(90deg,#030303_0%,rgba(3,3,3,.96)_30%,rgba(3,3,3,.62)_56%,rgba(3,3,3,.16)_78%,rgba(3,3,3,.30)_100%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 -z-10 h-48 bg-gradient-to-t from-[#111111] to-transparent"
      />

      <div className="relative mx-auto flex min-h-[100svh] w-full max-w-[1500px] items-end px-5 pb-7 pt-[84vw] min-[420px]:pt-[78vw] sm:px-8 sm:pt-[48vw] md:items-center md:px-10 md:pt-[7.5rem] lg:px-12 lg:pb-12 lg:pt-[7rem] xl:px-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 hidden w-[55%] bg-[radial-gradient(circle_at_55%_78%,rgba(160,89,48,.28),transparent_32%)] lg:block"
        />

        <div
          className={cn(
            "relative z-10 flex w-full max-w-[620px] flex-col items-start",
            "fade-in slide-in-from-bottom-10 animate-in fill-mode-backwards duration-700 ease-out"
          )}
        >
          <span className="mb-4 text-[10px] font-[500] uppercase tracking-[0.42em] text-[#c78359] md:mb-5 md:text-[11px] lg:mb-6">
            OPE Club
          </span>

          <h1 className="max-w-[620px] text-left font-serif text-[clamp(2.35rem,3.9vw,4.25rem)] font-[400] leading-[1.04] tracking-[-0.03em] text-[#f3eee6]">
            O lugar onde quem ama{" "}
            <span className="text-[#c78359]">filosofia</span> e{" "}
            <span className="text-[#c78359]">literatura</span> se encontra.
          </h1>

          <p className="mt-5 max-w-[560px] text-left text-[14px] font-[400] leading-6 text-[#d6d0c7]/86 md:text-[15px] lg:mt-6">
            Leia os maiores filosofos e escritores da historia, participe de
            discussoes, compartilhe suas ideias e descubra novas perspectivas
            dentro de um aplicativo criado exclusivamente para leitores e
            amantes da filosofia.
          </p>

          <Button
            className="mt-7 h-[54px] w-full max-w-[260px] justify-between rounded-[8px]! border border-[#c78359]/35 bg-[linear-gradient(135deg,#8a5535,#2a1a13)] px-6 text-[11px] font-[500] uppercase tracking-[0.2em] text-[#fff7ee] shadow-[0_18px_60px_rgba(150,84,45,.25)] hover:bg-[linear-gradient(135deg,#9b6240,#352017)] md:mt-8 lg:mt-9 lg:h-[58px] lg:max-w-[286px] lg:px-7"
            render={<Link to="/entrar" />}
            nativeButton={false}
          >
            Assinar OPE Club
            <ArrowRightIcon data-icon="inline-end" className="size-5" />
          </Button>
        </div>
      </div>
    </section>
  );
}
