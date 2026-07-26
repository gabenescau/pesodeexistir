import { Button } from "@/components/ui/button";
import { ArrowRightIcon } from "lucide-react";

export function FinalClosing() {
  return (
    <section className="py-24 md:py-32 border-t border-border bg-card/30">
      <div className="px-4 md:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-[32px] md:text-[32px] font-[600] leading-[40px] tracking-[-1.28px] text-foreground mb-6">
            Alguns entram pelos livros.
            <br />
            Outros pelas conversas.
          </h2>
          <p className="text-muted-foreground text-[18px] font-[400] leading-[28px] mb-6 max-w-2xl mx-auto">
            Mas todos encontram um lugar para aprender, compartilhar ideias e
            descobrir novas leituras.
          </p>
          <p className="text-muted-foreground text-[18px] font-[400] leading-[28px] mb-8 max-w-2xl mx-auto">
            O OPE Club é um <strong>aplicativo que reúne biblioteca e comunidade
            em um único lugar</strong>, criado para quem acredita que um grande
            livro merece uma grande conversa.
          </p>

          <div className="mb-8">
            <span className="text-[48px] font-[600] leading-[48px] tracking-[-2.4px] text-foreground">R$27</span>
            <span className="text-muted-foreground text-[14px] font-[400] leading-[20px] block mt-1">
              /mês &middot; Cancele quando quiser.
            </span>
          </div>

          <Button className="h-12 px-8 text-[16px] font-[500] leading-[24px] rounded-[100px]">
            Entrar para o OPE Club{" "}
            <ArrowRightIcon data-icon="inline-end" className="size-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}
