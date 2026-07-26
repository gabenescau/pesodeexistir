import { HelpCircleIcon } from "lucide-react";

const faqs = [
  {
    q: "Por que cobrar mensalmente?",
    a: "Porque o OPE Club está sempre evoluindo. Novos conteúdos, melhorias no aplicativo e uma comunidade ativa fazem parte da experiência.",
  },
  {
    q: "É só uma biblioteca?",
    a: "Não. O principal objetivo do OPE Club é reunir pessoas apaixonadas por filosofia e literatura em um único lugar. A biblioteca é apenas uma parte da experiência.",
  },
  {
    q: "A comunidade é moderada?",
    a: "Sim. Nosso objetivo é manter um ambiente respeitoso e focado em boas discussões.",
  },
  {
    q: "Posso publicar meus próprios textos?",
    a: "Sim. Você pode publicar reflexões, comentar livros e participar das conversas da comunidade.",
  },
];

export function FAQ() {
  return (
    <section className="py-24 md:py-32 border-t border-border bg-card/50">
      <div className="px-4 md:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <span className="font-mono text-[12px] font-[400] text-muted-foreground uppercase tracking-[0.6px] mb-4 block">
              FAQ
            </span>
            <h2 className="text-[32px] md:text-[32px] font-[600] leading-[40px] tracking-[-1.28px] text-foreground">
              Perguntas frequentes
            </h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq) => (
              <details
                key={faq.q}
                className="group p-5 rounded-[12px] border border-border bg-card shadow-[0px_1px_1px_#00000005,0px_2px_2px_#0000000a] cursor-pointer"
              >
                <summary className="flex items-center justify-between text-[14px] font-[500] leading-[20px] tracking-[-0.28px] text-foreground list-none">
                  {faq.q}
                  <HelpCircleIcon className="size-4 text-muted-foreground group-open:rotate-90 transition-transform shrink-0" />
                </summary>
                <p className="mt-3 text-[14px] font-[400] leading-[20px] tracking-[-0.28px] text-muted-foreground">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
