import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import NumberFlow from "@number-flow/react";
import { CheckCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

const plan = {
  name: "OPE Club",
  info: "Biblioteca + Comunidade em um único aplicativo",
  price: 27,
  features: [
    "Biblioteca integrada ao aplicativo",
    "Comunidade exclusiva dentro do aplicativo",
    "Publicações ilimitadas",
    "Discussões sobre livros e autores",
    "Recomendações da comunidade",
    "Novos conteúdos semanalmente",
    "Leitura offline",
    "Atualizações constantes",
    "Acesso em todos os dispositivos",
  ],
};

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
              Tudo que você precisa em um único plano.
            </h2>
            <p className="text-muted-foreground mt-4 max-w-xl mx-auto text-[16px] font-[400] leading-[24px]">
              Mais do que um aplicativo de leitura. Uma plataforma onde você lê,
              aprende e conversa sobre as ideias que realmente importam.
            </p>
          </div>

          <div className="max-w-md mx-auto">
            <PricingCard plan={plan} />
          </div>
        </div>
      </div>
    </section>
  );
}

function PricingCard({ plan, className, ...props }) {
  return (
    <div
      className={cn(
        "relative flex w-full flex-col overflow-hidden rounded-[12px] border border-border bg-card",
        "shadow-[0px_1px_1px_#00000005,0px_2px_2px_#0000000a,0px_8px_16px_-4px_#0000000a]",
        "before:absolute before:inset-0 before:rounded-[12px] before:shadow-[inset_0_0_0_1px_#ffffff08] before:pointer-events-none",
        className
      )}
      {...props}
    >
      <div className="border-b border-border p-8">
        <div className="text-[24px] font-[600] leading-[32px] tracking-[-0.96px] text-foreground">{plan.name}</div>
        <p className="font-[400] text-muted-foreground text-[16px] leading-[24px] mt-1">{plan.info}</p>
        <h3 className="mt-6 mb-1 flex w-max items-end gap-1">
          <span className="text-[24px] font-[600] leading-[32px] tracking-[-0.96px] text-foreground">R$</span>
          <NumberFlow
            className="font-[600] text-[48px] leading-[48px] tracking-[-2.4px] [&::part(suffix)]:font-[400] [&::part(suffix)]:text-base [&::part(suffix)]:text-muted-foreground"
            value={plan.price}
          />
        </h3>
        <p className="mb-2 font-[400] text-muted-foreground text-[12px] leading-[16px]">
          /mês &middot; Cancele quando quiser
        </p>
      </div>

      <div className="space-y-3 px-8 pt-6 pb-8 text-muted-foreground text-[14px] font-[400] leading-[20px] tracking-[-0.28px]">
        {plan.features.map((feature) => (
          <div className="flex items-center gap-2" key={feature}>
            <CheckCircleIcon className="size-4 text-primary shrink-0" />
            <p>{feature}</p>
          </div>
        ))}
      </div>

      <div className="mt-auto w-full border-t border-border p-4">
        <Button className="w-full text-[16px] font-[500] leading-[24px] rounded-[100px] h-12" render={<Link to="/entrar" />} nativeButton={false}>
          Assinar agora
        </Button>
      </div>
    </div>
  );
}
