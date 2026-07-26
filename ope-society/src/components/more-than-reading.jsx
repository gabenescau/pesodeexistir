import { cn } from "@/lib/utils";
import { CheckIcon } from "lucide-react";

const items = [
  "Compartilhar reflexões",
  "Publicar textos",
  "Descobrir novos livros",
  "Conversar com outros leitores",
  "Comentar publicações",
  "Seguir pessoas",
  "Salvar conteúdos",
  "Participar das discussões",
];

export function MoreThanReading() {
  return (
    <section className="py-24 md:py-32 border-t border-border bg-card/30">
      <div className="px-4 md:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-20 items-center">
            <div>
              <span className="font-mono text-[12px] font-[400] text-muted-foreground uppercase tracking-[0.6px] mb-4 block">
                Dentro do aplicativo
              </span>
              <h2 className="text-[32px] md:text-[32px] font-[600] leading-[40px] tracking-[-1.28px] text-foreground mb-6">
                Aqui a leitura<br />continua.
              </h2>
              <p className="text-[18px] font-[400] leading-[28px] text-muted-foreground">
                Tudo isso <strong>sem depender de grupos de WhatsApp, Telegram
                ou Discord.</strong> Toda a experiência acontece dentro do
                OPE Club.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {items.map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-3 p-3 rounded-[8px] border border-border bg-card shadow-[0px_1px_1px_#00000005,0px_2px_2px_#0000000a]"
                >
                  <div className="size-7 rounded-[6px] bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckIcon className="size-3.5 text-primary" />
                  </div>
                  <span className="text-[14px] font-[400] leading-[20px] tracking-[-0.28px] text-foreground/90">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
