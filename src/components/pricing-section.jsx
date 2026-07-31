import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PLANS } from "@/lib/abacatepay";
import { PlanBenefitList } from "@/components/plan-benefit";

export function PricingSection() {
  return (
    <section id="planos" className="py-24 md:py-32 border-t border-border bg-card/30">
      <div className="px-4 md:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="font-mono text-[12px] font-[400] text-muted-foreground uppercase tracking-[0.6px] mb-4 block">
              Planos
            </span>
            <h2 className="text-[32px] md:text-[32px] font-[600] leading-[40px] tracking-[-1.28px] text-foreground">
              Escolha o plano ideal para você
            </h2>
            <p className="text-muted-foreground mt-4 max-w-xl mx-auto text-[16px] font-[400] leading-[24px]">
              Mais do que um aplicativo de leitura. Uma plataforma onde você lê,
              aprende e conversa sobre as ideias que realmente importam.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {Object.values(PLANS).map((plan) => {
              const isAnnual = plan.id === "annual";
              return (
                <PricingCard key={plan.id} plan={plan} featured={isAnnual} />
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function PricingCard({ plan: p, featured, className, ...props }) {
  const isAnnual = p.id === "annual";

  return (
    <div
      className={cn(
        "relative flex w-full flex-col overflow-hidden rounded-[12px] border border-border bg-card",
        "shadow-[var(--shadow-sm)]",
        "before:absolute before:inset-0 before:rounded-[12px] before:shadow-[inset_0_0_0_1px_#ffffff08] before:pointer-events-none",
        featured && "border-primary/30 ring-1 ring-primary/20",
        className
      )}
      {...props}
    >
      {isAnnual && (
        <span className="absolute -top-3 right-6 z-10 rounded-full bg-primary px-4 py-1.5 text-[11px] font-[700] uppercase tracking-[0.12em] text-primary-foreground shadow-lg">
          {p.discountText}
        </span>
      )}

      <div className="border-b border-border p-8">
        <div className="text-[24px] font-[600] leading-[32px] tracking-[-0.96px] text-foreground">{p.label}</div>
        <p className="font-[400] text-muted-foreground text-[16px] leading-[24px] mt-1">{p.description}</p>
        <h3 className="mt-6 mb-1 flex w-max items-end gap-1">
          <span className="text-[24px] font-[600] leading-[32px] tracking-[-0.96px] text-foreground">R$</span>
          <span className="font-[600] text-[48px] leading-[48px] tracking-[-2.4px] text-foreground">
            {isAnnual ? p.monthlyEquivalent : (p.price / 100)}
          </span>
          <span className="text-[16px] font-[500] text-muted-foreground mb-1.5 ml-1">/mês</span>
        </h3>
        <p className="mb-2 font-[400] text-muted-foreground text-[12px] leading-[16px]">
          {isAnnual ? (
            <>
              <span className="line-through">R$ {(p.monthlyEquivalent * 2).toFixed(2).replace(".", ",")}/mês</span>
              <span className="ml-1.5">cobrados uma vez por ano ({p.priceFormatted})</span>
            </>
          ) : (
            `${p.period} · Cancele quando quiser`
          )}
        </p>
        {isAnnual && (
          <p className="text-[13px] font-[500] text-primary">
            Economize 40% no plano anual!
          </p>
        )}
      </div>

      <div className="space-y-3 px-8 pt-6 pb-8 text-muted-foreground text-[14px] font-[400] leading-[20px] tracking-[-0.28px]">
        <PlanBenefitList
          benefits={p.benefits}
          separator={isAnnual}
          itemClassName="flex items-center gap-2"
          iconClassName="size-4 text-primary shrink-0"
        />
      </div>

      <div className="mt-auto w-full border-t border-border p-4">
        <Button
          className={cn(
            "w-full text-[16px] font-[500] leading-[24px] rounded-[100px] h-12",
            featured && "bg-primary text-primary-foreground hover:bg-primary/90"
          )}
          render={<Link to="/entrar" />}
          nativeButton={false}
        >
          Assinar {p.label}
        </Button>
      </div>
    </div>
  );
}