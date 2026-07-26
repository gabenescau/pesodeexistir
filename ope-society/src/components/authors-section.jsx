import { cn } from "@/lib/utils";
import { useRef, useEffect, useState } from "react";

const authors = [
  { name: "Friedrich Nietzsche", image: "/autores/friedrich nietzsche.jpg", theme: "Existencialismo", tags: ["Moral", "Vontade de potência", "Além do bem e do mal"] },
  { name: "Albert Camus", image: "/autores/albert camus.jpg", theme: "Absurdismo", tags: ["Absurdo", "Liberdade", "Sentido da vida"] },
  { name: "Fiódor Dostoiévski", image: "/autores/dostoievisk.jpg", theme: "Existencialismo", tags: ["Natureza humana", "Culpa", "Redenção"] },
  { name: "Jean-Paul Sartre", image: "/autores/sartre.jpg", theme: "Existencialismo", tags: ["Liberdade", "Responsabilidade", "O ser e o nada"] },
  { name: "Franz Kafka", image: "/autores/franz kafka.jpg", theme: "Absurdismo", tags: ["Burocracia", "Angústia", "Metamorfose"] },
  { name: "Fernando Pessoa", image: "/autores/fernando pessoa.jpg", theme: "Modernismo", tags: ["Heterônimos", "Identidade", "Poesia"] },
  { name: "Clarice Lispector", image: "/autores/clarice lispector.jpg", theme: "Modernismo", tags: ["Introspecção", "Feminino", "Existência"] },
  { name: "Virginia Woolf", image: "/autores/virginia wolf.jpg", theme: "Modernismo", tags: ["Consciência", "Feminismo", "Fluxo de pensamento"] },
  { name: "Arthur Schopenhauer", image: "/autores/schopenhauer 2.jpg", theme: "Pessimismo", tags: ["Vontade", "Dor", "Arte"] },
  { name: "Sigmund Freud", image: "/autores/freud.jpg", theme: "Psicanálise", tags: ["Inconsciente", "Sonhos", "Desejo"] },
  { name: "Jacques Lacan", image: "/autores/lacan.jpg", theme: "Psicanálise", tags: ["Linguagem", "Falta", "Desejo"] },
  { name: "Charles Bukowski", image: "/autores/bukowski.jpg", theme: "Realismo Sujo", tags: ["Marginal", "Poesia", "Crudeza"] },
  { name: "Sylvia Plath", image: "/autores/silva plath.jpg", theme: "Poesia Confessional", tags: ["Melancolia", "Feminino", "Intensidade"] },
  { name: "Osamu Dazai", image: "/autores/osamudazai.jpg", theme: "Existencialismo", tags: ["Declínio", "Humanidade", "Autodestruição"] },
];

const img = (path) => encodeURI(path);

export function AuthorsSection() {
  const scrollRef = useRef(null);
  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(false);

  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const id = setInterval(() => {
      if (isPausedRef.current || !el) return;
      const maxScroll = el.scrollWidth - el.clientWidth;
      if (el.scrollLeft >= maxScroll - 1) {
        el.scrollTo({ left: 0, behavior: "instant" });
      } else {
        el.scrollBy({ left: 1 });
      }
    }, 25);
    return () => clearInterval(id);
  }, []);

  return (
    <section id="autores" className="py-24 md:py-32 border-t border-border bg-card/30">
      <div className="px-4 md:px-8 mb-12">
        <div className="max-w-6xl mx-auto">
          <span className="font-mono text-[12px] font-[400] text-muted-foreground uppercase tracking-[0.6px] mb-4 block">
            Os autores
          </span>
          <h2 className="text-[32px] md:text-[32px] font-[600] leading-[40px] tracking-[-1.28px] text-foreground">
            Grandes mentes.<br />Uma única comunidade.
          </h2>
        </div>
      </div>

      <div className="relative">
        <div
          ref={scrollRef}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          className="flex gap-5 overflow-x-auto px-4 md:px-8 pb-4"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {authors.map((author, i) => (
            <div
              key={`${author.name}-${i}`}
              className="flex-shrink-0 w-[280px] sm:w-[320px] group"
            >
              <div
                className={cn(
                  "relative h-[420px] rounded-[12px] overflow-hidden border border-border bg-card",
                  "shadow-[0px_1px_1px_#00000005,0px_2px_2px_#0000000a]",
                  "transition-all duration-500 ease-out",
                  "group-hover:border-primary/30 group-hover:shadow-[0px_2px_2px_#0000000a,0px_8px_16px_-4px_#0000000a]"
                )}
              >
                <div className="absolute inset-0">
                  <img
                    src={img(author.image)}
                    alt={author.name}
                    className="author-card-image size-full object-cover opacity-75 group-hover:opacity-90 group-hover:scale-105 transition-all duration-700"
                    loading="lazy"
                  />
                  <div className="author-card-overlay absolute inset-0 bg-linear-to-t from-[#030303]/88 via-[#030303]/36 to-transparent" />
                </div>

                <div className="author-card-content relative h-full flex flex-col justify-end p-6">
                  <div className="mb-auto pt-4">
                    <span className="inline-block px-3 py-1 rounded-[6px] bg-primary/20 border border-primary/30 text-xs font-medium text-primary">
                      {author.theme}
                    </span>
                  </div>

                  <div className="mb-5">
                    <h3 className="text-2xl font-medium text-foreground mb-1">
                      {author.name}
                    </h3>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {author.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-xs text-muted-foreground bg-background/50 px-2 py-1 rounded-[6px] border border-border/50"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="absolute inset-y-0 left-0 w-16 bg-linear-to-r from-background to-transparent pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-16 bg-linear-to-l from-background to-transparent pointer-events-none" />
      </div>
    </section>
  );
}
