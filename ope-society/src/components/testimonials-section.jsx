import { cn } from "@/lib/utils";
import { InfiniteSlider } from "@/components/infinite-slider";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";

const testimonials = [
  {
    quote: "Nunca consegui conversar sobre filosofia com meus amigos. Aqui sempre encontro alguém lendo o mesmo livro.",
    name: "Ana Clara",
    role: "Leitora",
    company: "Há 3 meses",
  },
  {
    quote: "Achei que estava comprando uma biblioteca. Hoje entro todos os dias principalmente pelas conversas.",
    name: "Rafael M.",
    role: "Leitor",
    company: "Há 6 meses",
  },
  {
    quote: "Descobri mais autores pela comunidade do que pesquisando sozinho.",
    name: "Juliana T.",
    role: "Leitora",
    company: "Há 2 meses",
  },
  {
    quote: "Finalmente um lugar onde posso publicar minhas reflexões e receber feedback de verdade.",
    name: "Lucas F.",
    role: "Leitor",
    company: "Há 4 meses",
  },
  {
    quote: "A curadoria é fantástica. Cada semana descubro um autor novo que muda minha forma de pensar.",
    name: "Marina S.",
    role: "Leitora",
    company: "Há 5 meses",
  },
  {
    quote: "O que me prendeu não foi o acervo, foi ver outras pessoas tão apaixonadas por livros quanto eu.",
    name: "Diego R.",
    role: "Leitor",
    company: "Há 7 meses",
  },
  {
    quote: "Li mais em 3 meses dentro do OPE Club do que no ano inteiro passado.",
    name: "Camila L.",
    role: "Leitora",
    company: "Há 3 meses",
  },
  {
    quote: "É raro encontrar um espaço assim: inteligente, acolhedor e sem barulho.",
    name: "Thiago A.",
    role: "Leitor",
    company: "Há 2 meses",
  },
  {
    quote: "Já entrei por causa dos livros. Fiquei por causa das discussões.",
    name: "Beatriz C.",
    role: "Leitora",
    company: "Há 8 meses",
  },
];

const firstColumn = testimonials.slice(0, 3);
const secondColumn = testimonials.slice(3, 6);
const thirdColumn = testimonials.slice(6, 9);

export function TestimonialsSection() {
  return (
    <section id="depoimentos" className="py-24 md:py-32 border-t border-border bg-card/50">
      <div className="px-4 md:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="font-mono text-[12px] font-[400] text-muted-foreground uppercase tracking-[0.6px] mb-4 block">
              Depoimentos
            </span>
            <h2 className="text-[32px] md:text-[32px] font-[600] leading-[40px] tracking-[-1.28px] text-foreground">
              Quem está dentro aprova.
            </h2>
          </div>

          <div
            className={cn(
              "flex max-h-160 justify-center gap-6 overflow-hidden",
              "mask-[linear-gradient(to_bottom,transparent,black_25%,black_75%,transparent)]"
            )}
          >
            <InfiniteSlider direction="vertical" speed={30} speedOnHover={15}>
              {firstColumn.map((testimonial) => (
                <TestimonialsCard key={testimonial.name} testimonial={testimonial} />
              ))}
            </InfiniteSlider>
            <InfiniteSlider
              className="hidden md:block"
              direction="vertical"
              speed={50}
              speedOnHover={25}
            >
              {secondColumn.map((testimonial) => (
                <TestimonialsCard key={testimonial.name} testimonial={testimonial} />
              ))}
            </InfiniteSlider>
            <InfiniteSlider
              className="hidden lg:block"
              direction="vertical"
              speed={35}
              speedOnHover={17}
            >
              {thirdColumn.map((testimonial) => (
                <TestimonialsCard key={testimonial.name} testimonial={testimonial} />
              ))}
            </InfiniteSlider>
          </div>
        </div>
      </div>
    </section>
  );
}

function TestimonialsCard({ testimonial, className, ...props }) {
  const { quote, name, role, company } = testimonial;
  return (
    <figure
      className={cn(
        "w-full max-w-xs rounded-[12px] border border-border bg-card p-6 shadow-[0px_1px_1px_#00000005,0px_2px_2px_#0000000a,0px_8px_8px_-8px_#0000000a]",
        "before:absolute before:inset-0 before:rounded-[12px] before:shadow-[inset_0_0_0_1px_#ffffff08] before:pointer-events-none relative",
        className
      )}
      {...props}
    >
      <blockquote className="text-[14px] font-[400] leading-[20px] tracking-[-0.28px] text-foreground/90 italic">
        &ldquo;{quote}&rdquo;
      </blockquote>
      <figcaption className="mt-5 flex items-center gap-2">
        <Avatar className="size-8 rounded-full">
          <AvatarFallback className="text-xs bg-primary/10 text-primary">
            {name.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <cite className="font-[500] not-italic leading-5 tracking-tight text-[14px] text-foreground">
            {name}
          </cite>
          <span className="text-muted-foreground text-[14px] leading-5 tracking-tight">
            {role} &middot; {company}
          </span>
        </div>
      </figcaption>
    </figure>
  );
}
