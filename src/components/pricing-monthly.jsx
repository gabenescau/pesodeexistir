import { Button } from "@/components/ui/button";
import { ArrowRightIcon, CheckIcon } from "lucide-react";

const features = [
  "Biblioteca integrada ao aplicativo",
  "Comunidade exclusiva dentro do aplicativo",
  "Publicações ilimitadas",
  "Discussões sobre livros e autores",
  "Recomendações da comunidade",
  "Novos conteúdos semanalmente",
  "Leitura offline",
  "Atualizações constantes",
  "Acesso em todos os dispositivos",
];

export function PricingMonthly() {
  return (
    <section className="py-24 md:py-32 border-t border-border">
      <div className="px-4 md:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-4 block">
              Plano
            </span>
            <h2 className="text-3xl md:text-5xl font-normal tracking-tight text-foreground mb-4">
              Faça parte do OPE Club
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Mais do que um aplicativo de leitura. Uma plataforma onde você lê,
              aprende e conversa com pessoas que compartilham o mesmo interesse
              por filosofia e literatura.
            </p>
          </div>

          <div className="max-w-md mx-auto">
            <div className="p-8 rounded-2xl border border-border bg-card text-center">
              <div className="mb-6">
                <span className="text-5xl font-bold text-foreground">
                  R$27
                </span>
                <span className="text-muted-foreground text-base block mt-1">
                  /mês
                </span>
              </div>

              <ul className="space-y-3 mb-8 text-left">
                {features.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm">
                    <CheckIcon className="size-4 text-primary mt-0.5 shrink-0" />
                    <span className="text-foreground/90">{f}</span>
                  </li>
                ))}
              </ul>

              <Button className="w-full h-12 rounded-full text-sm font-medium">
                Entrar para o OPE Club{" "}
                <ArrowRightIcon data-icon="inline-end" className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
