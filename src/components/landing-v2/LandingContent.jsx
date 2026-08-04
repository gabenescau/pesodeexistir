import { AtSign, BookMarked, Compass, CreditCard, MessagesSquare } from "@/lib/icons";

const features = [
  {
    icon: BookMarked,
    title: "Leitor Nativo no App",
    text: "Leia diretamente na plataforma com contagem inteligente de tempo, tipografia ajustável e sem baixar PDFs.",
  },
  {
    icon: MessagesSquare,
    title: "Rede Social Integrada",
    text: "Feed no estilo Twitter/Reddit para postar reflexões, comentar em citações e debater ideias com outros leitores.",
  },
  {
    icon: Compass,
    title: "Gamificação & XP",
    text: "Evolua seu perfil com XP perpétuo, conquiste títulos, selos de verificado e dispute o ranking mensal de leitura.",
  },
  {
    icon: CreditCard,
    title: "Loja OPE com Frete Grátis",
    text: "Use seus Créditos OPE para resgatar livros físicos, edições de luxo, moletons pesados e camisetas oversized.",
  },
];

export function LandingAbout() {
  return (
    <section id="sobre" className="relative bg-[var(--landing-bg)] py-16 sm:py-24 md:py-32">
      <div className="mx-auto w-full max-w-[1280px] px-4 sm:px-6">
        {/* Section Header - Perfectly Centered & Aligned */}
        <div className="mx-auto max-w-2xl text-center mb-10 sm:mb-16">
          <h2 className="text-[clamp(1.9rem,4.5vw,3.3rem)] font-medium leading-tight tracking-tight text-[var(--landing-fg)] text-balance">
            O criador por trás do OPE Club
          </h2>
          <p className="mt-3.5 sm:mt-4 text-[14px] sm:text-[16px] leading-relaxed text-[var(--landing-muted)]">
            Construído por quem lê, estuda e vive os livros todos os dias.
          </p>
        </div>

        {/* Clean Editorial Showcase */}
        <div className="grid items-center gap-8 sm:gap-10 lg:grid-cols-12 lg:gap-14">
          {/* Left: Visual Editorial Card */}
          <div className="lg:col-span-5">
            <div className="group relative overflow-hidden rounded-2xl sm:rounded-3xl border border-[var(--landing-border)] bg-[var(--landing-surface)] shadow-2xl transition-all duration-500 hover:border-[var(--landing-brand)]/40">
              {/* Banner */}
              <div className="relative aspect-[16/11] sm:aspect-[4/3] w-full overflow-hidden bg-black">
                <img
                  src="https://i.pinimg.com/1200x/54/87/29/54872934a604ef97bee48234e79b57ca.jpg"
                  alt="Gabe Nescau - Criador do OPE Club"
                  className="size-full object-cover opacity-90 transition-transform duration-700 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />
                
                {/* Bottom Overlay with Avatar & Profile */}
                <div className="absolute bottom-4 left-4 right-4 sm:bottom-5 sm:left-5 sm:right-5 flex items-center justify-between">
                  <div className="flex items-center gap-3 sm:gap-3.5">
                    <img
                      src="/gabe-nescau.jpg"
                      alt="Gabe Nescau"
                      className="size-12 sm:size-14 rounded-xl sm:rounded-2xl border-2 border-white/20 object-cover shadow-lg"
                    />
                    <div>
                      <h3 className="text-base sm:text-lg font-semibold tracking-tight text-white">Gabe Nescau</h3>
                      <p className="text-[11px] sm:text-xs text-white/70">Idealizador • OPE Club</p>
                    </div>
                  </div>

                  <a
                    href="https://www.instagram.com/gabenescau/"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex size-9 sm:size-10 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white backdrop-blur-md transition-all hover:scale-105 hover:bg-white hover:text-black"
                    aria-label="Instagram de Gabe Nescau"
                  >
                    <AtSign className="size-4" />
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Editorial Narrative */}
          <div className="lg:col-span-7 space-y-5 sm:space-y-6">
            <h3 className="text-xl sm:text-2xl lg:text-3xl font-medium leading-snug tracking-tight text-[var(--landing-fg)]">
              Um refúgio para quem busca profundidade e diálogo real.
            </h3>
            
            <div className="space-y-3.5 sm:space-y-4 text-[14px] sm:text-[15px] leading-relaxed text-[var(--landing-muted)]">
              <p>
                O OPE Club nasceu da necessidade de criar um espaço onde a leitura não fosse solitária e as conversas não fossem superficiais. Aqui você encontra pessoas com o mesmo amor pelo conhecimento, sem algoritmos que dispersam sua atenção.
              </p>
              <p>
                Cada página lida conta de verdade: você evolui seu perfil, troca ideias com outros leitores e conquista recompensas físicas entregues na sua casa.
              </p>
            </div>

            <div className="rounded-2xl border-l-2 border-[var(--landing-brand)] bg-[var(--landing-surface)] p-4 sm:p-5 backdrop-blur-sm">
              <p className="text-[14px] sm:text-[15px] italic text-[var(--landing-fg)]">
                “Ler as grandes obras é dialogar com os espíritos mais brilhantes da história. Ter com quem compartilhar esse diálogo é o que dá sentido à jornada.”
              </p>
              <span className="mt-2 block text-xs text-[var(--landing-muted)]">
                — Gabe Nescau
              </span>
            </div>

            <div className="pt-2">
              <a
                href="https://www.instagram.com/gabenescau/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-12 w-full sm:w-auto items-center justify-center gap-2.5 rounded-xl border border-[var(--landing-border)] bg-[var(--landing-hover)] px-7 text-xs font-semibold uppercase tracking-wider text-[var(--landing-fg)] transition-all hover:border-[var(--landing-brand)]/60 hover:bg-[var(--landing-surface)] shadow-sm text-center"
              >
                <AtSign className="size-4" />
                <span>Acessar meu perfil</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function LandingFeatures() {
  return (
    <section id="recursos" className="border-t border-[var(--landing-border)] bg-[var(--landing-bg)] py-16 sm:py-24 md:py-32">
      <div className="mx-auto w-full max-w-[1280px] px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center mb-10 sm:mb-16">
          <h2 className="text-[clamp(1.9rem,4.5vw,3.3rem)] font-medium leading-tight tracking-tight text-[var(--landing-fg)] text-balance">
            Tudo o que você precisa em um único ecossistema.
          </h2>
          <p className="mt-3.5 sm:mt-4 text-[14px] sm:text-[16px] leading-relaxed text-[var(--landing-muted)]">
            Construído de ponta a ponta para enriquecer sua rotina de leitura intelectual.
          </p>
        </div>

        <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <article
              key={feature.title}
              className="group rounded-2xl sm:rounded-3xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-6 sm:p-8 transition-all duration-300 hover:border-[var(--landing-brand)]/40 hover:shadow-xl"
              style={{
                backgroundImage: "radial-gradient(ellipse at 31% -7%, rgba(255,255,255,0.06), transparent)",
              }}
            >
              <div className="flex size-10 sm:size-11 items-center justify-center rounded-xl bg-white/[0.06] border border-white/10 text-[var(--landing-fg)] transition-transform duration-300 group-hover:scale-110">
                <feature.icon className="size-5" />
              </div>
              <h3 className="mt-5 sm:mt-6 text-base sm:text-lg font-semibold tracking-tight text-[var(--landing-fg)]">{feature.title}</h3>
              <p className="mt-2 text-xs sm:text-sm leading-relaxed text-[var(--landing-muted)]">{feature.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
