import { cn } from "@/lib/utils";
import { StarIcon, QuoteIcon } from "lucide-react";

const testimonials = [
  {
    text: "Nunca consegui conversar sobre filosofia com meus amigos. Aqui sempre encontro alguém lendo o mesmo livro.",
    author: "Leitor verificado",
  },
  {
    text: "Achei que estava comprando uma biblioteca. Hoje entro todos os dias principalmente pelas conversas.",
    author: "Leitor verificado",
  },
  {
    text: "Descobri mais autores pela comunidade do que pesquisando sozinho.",
    author: "Leitor verificado",
  },
];

export function Testimonials() {
  return (
    <section className="py-24 md:py-32 border-t border-border">
      <div className="px-4 md:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-4 block">
              Depoimentos
            </span>
            <h2 className="text-3xl md:text-5xl font-normal tracking-tight text-foreground">
              Quem está dentro aprova.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div
                key={t.text}
                className="p-6 rounded-2xl border border-border bg-card"
              >
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <StarIcon
                      key={j}
                      size={14}
                      className="text-primary fill-primary"
                    />
                  ))}
                </div>
                <QuoteIcon className="size-5 text-primary/30 mb-2" />
                <p className="text-sm text-foreground/90 leading-relaxed italic mb-4">
                  &ldquo;{t.text}&rdquo;
                </p>
                <span className="text-xs text-muted-foreground">
                  {t.author}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
