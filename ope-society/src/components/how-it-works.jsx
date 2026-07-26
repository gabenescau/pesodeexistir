import { cn } from "@/lib/utils";
import { CreditCard, LogIn, MessageCircle } from "lucide-react";

const steps = [
  {
    number: "1",
    title: "Assine o OPE Club.",
    description:
      "Escolha o plano mensal e tenha acesso imediato a todo o conteúdo.",
    icon: <CreditCard />,
  },
  {
    number: "2",
    title: "Receba acesso imediato.",
    description:
      "Baixe o aplicativo e comece a explorar a biblioteca e a comunidade.",
    icon: <LogIn />,
  },
  {
    number: "3",
    title: "Leia, participe e descubra.",
    description:
      "Acesse os livros, publique reflexões e converse com outros leitores todos os dias.",
    icon: <MessageCircle />,
  },
];

export function HowItWorks() {
  return (
    <section className="py-24 md:py-32 border-t border-border">
      <div className="px-4 md:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="font-mono text-[12px] font-[400] text-muted-foreground uppercase tracking-[0.6px] mb-4 block">
              Como funciona
            </span>
            <h2 className="text-[32px] md:text-[32px] font-[600] leading-[40px] tracking-[-1.28px] text-foreground">
              Simples como ler um livro.
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {steps.map((step) => (
              <FeatureCard key={step.number} feature={step} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FeatureCard({ feature, className, ...props }) {
  return (
    <div
      className={cn(
        "relative flex flex-col justify-between gap-6 rounded-[12px] border border-border bg-card p-8",
        "shadow-[0px_1px_1px_#00000005,0px_2px_2px_#0000000a,0px_8px_8px_-8px_#0000000a]",
        "dark:bg-[radial-gradient(50%_80%_at_25%_0%,--theme(--color-foreground/.1),transparent)]",
        className
      )}
      {...props}
    >
      <div
        className={cn(
          "relative z-10 flex w-fit items-center justify-center rounded-[8px] border border-border bg-card p-3",
          "[&_svg]:size-5 [&_svg]:stroke-[1.5] [&_svg]:text-foreground"
        )}
      >
        {feature.icon}
      </div>

      <div className="relative z-10 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-primary text-[14px] font-[500]">{feature.number}.</span>
          <h3 className="font-[500] text-[16px] leading-[24px] text-foreground">
            {feature.title}
          </h3>
        </div>
        <p className="text-muted-foreground text-[14px] font-[400] leading-[20px] tracking-[-0.28px]">
          {feature.description}
        </p>
      </div>
    </div>
  );
}
