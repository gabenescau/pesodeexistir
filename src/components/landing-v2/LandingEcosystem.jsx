import { BookOpen, Flame, Layers, MessageSquare, Trophy, Truck, Shirt, Compass, Sparkles, ArrowRight, ShieldCheck, CheckCircle2, Bookmark } from "@/lib/icons";
import { Link } from "react-router-dom";

export function LandingEcosystem() {
  return (
    <section id="ecossistema" className="relative overflow-hidden bg-[var(--landing-bg)] py-16 sm:py-24 md:py-32">
      {/* Background Radial Glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-b from-[var(--landing-brand)]/10 to-transparent blur-3xl opacity-50"
      />

      <div className="mx-auto w-full max-w-[1280px] px-4 sm:px-6">
        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-[clamp(1.9rem,4.5vw,3.4rem)] font-medium leading-[1.08] tracking-tight text-[var(--landing-fg)] text-balance">
            Muito mais que um leitor. <br />
            Um ecossistema completo para leitores.
          </h2>
          <p className="mx-auto mt-3.5 sm:mt-4 max-w-2xl text-[14px] sm:text-[16px] leading-relaxed text-[var(--landing-muted)]">
            O OPE Club integra leitura digital sem PDFs, rede social de discussões profundas, progressão com XP perpétuo e resgate de produtos físicos com frete grátis.
          </p>
        </div>

        {/* Kirvano-style Live App Interface Showcase Window */}
        <div className="mt-10 sm:mt-16 overflow-hidden rounded-2xl sm:rounded-3xl border border-[var(--landing-border)] bg-[var(--landing-surface)] shadow-2xl">
          {/* Window Chrome Header */}
          <div className="flex items-center justify-between border-b border-[var(--landing-border)] px-4 py-3 sm:px-6 sm:py-3.5 bg-black/40">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="size-2.5 sm:size-3 rounded-full bg-white/20" />
              <span className="size-2.5 sm:size-3 rounded-full bg-white/20" />
              <span className="size-2.5 sm:size-3 rounded-full bg-white/20" />
              <span className="ml-2 sm:ml-3 font-mono text-[10px] sm:text-[11px] text-[var(--landing-muted)]">app.pesodeexistir.online</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex size-2 rounded-full bg-[var(--landing-fg)] opacity-70" />
              <span className="font-mono text-[10px] sm:text-[11px] text-[var(--landing-muted)] hidden sm:inline">Ecossistema Conectado</span>
              <span className="font-mono text-[10px] text-[var(--landing-muted)] sm:hidden">Online</span>
            </div>
          </div>

          {/* Mobile Top Navigation Tabs (Visible only on < lg) */}
          <div className="flex lg:hidden overflow-x-auto border-b border-[var(--landing-border)] bg-black/30 px-3 py-2 gap-2 [scrollbar-width:none]">
            <div className="flex items-center gap-2 rounded-lg bg-[var(--landing-hover)] px-3 py-1.5 text-xs font-medium text-[var(--landing-fg)] shrink-0">
              <BookOpen className="size-3.5 text-[var(--landing-brand)]" />
              <span>Biblioteca</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-[var(--landing-muted)] shrink-0">
              <MessageSquare className="size-3.5" />
              <span>Feed &amp; Debates</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-[var(--landing-muted)] shrink-0">
              <Trophy className="size-3.5" />
              <span>Ranking</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-[var(--landing-muted)] shrink-0">
              <Shirt className="size-3.5" />
              <span>Loja</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[460px]">
            {/* Sidebar Navigation */}
            <aside className="hidden lg:flex lg:col-span-4 xl:col-span-3 border-r border-[var(--landing-border)] bg-black/20 p-5 flex-col justify-between">
              <div className="space-y-6">
                <div className="flex items-center gap-3 px-1">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-[var(--landing-brand)] font-mono text-xs font-bold text-[var(--landing-brand-fg)]">
                    OPE
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-[var(--landing-fg)]">Clube do Leitor</div>
                    <div className="text-[10px] text-[var(--landing-muted)]">Membro Verificado</div>
                  </div>
                </div>

                <div className="space-y-1.5 pt-2">
                  <div className="flex items-center gap-3 rounded-xl bg-[var(--landing-hover)] px-3 py-2.5 text-xs font-medium text-[var(--landing-fg)]">
                    <BookOpen className="size-4 text-[var(--landing-brand)]" />
                    <span>Biblioteca Digital</span>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs text-[var(--landing-muted)] hover:bg-[var(--landing-hover)] transition-colors">
                    <MessageSquare className="size-4" />
                    <span>Feed Social &amp; Debates</span>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs text-[var(--landing-muted)] hover:bg-[var(--landing-hover)] transition-colors">
                    <Trophy className="size-4" />
                    <span>Ranking Mensal</span>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs text-[var(--landing-muted)] hover:bg-[var(--landing-hover)] transition-colors">
                    <Shirt className="size-4" />
                    <span>Loja Oficial &amp; Roupas</span>
                  </div>
                </div>
              </div>

              {/* Mini User Status */}
              <div className="rounded-xl border border-[var(--landing-border)] bg-black/40 p-3.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--landing-muted)]">Nível Atual</span>
                  <span className="font-mono font-semibold text-[var(--landing-fg)]">Nv. 14 Pensador</span>
                </div>
                <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div className="h-full w-[78%] rounded-full bg-[var(--landing-brand)]" />
                </div>
              </div>
            </aside>

            {/* Main Interactive Showcase Area */}
            <div className="lg:col-span-8 xl:col-span-9 p-4 sm:p-6 lg:p-8 flex flex-col justify-between gap-5 sm:gap-6">
              {/* Top Widgets Grid (Kirvano Metric Style) */}
              <div className="grid gap-3.5 sm:gap-4 grid-cols-1 sm:grid-cols-3">
                {/* Card 1: Warm Cream Highlight */}
                <div className="rounded-2xl bg-[#ded8ca] p-4 sm:p-5 text-[#111111] flex flex-col justify-between shadow-sm">
                  <div>
                    <span className="text-[11px] sm:text-xs uppercase tracking-wider text-[#111111]/60 font-mono">Tempo Lido</span>
                    <div className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-bold tracking-tight">48h 20min</div>
                  </div>
                  <div className="mt-3 sm:mt-4 flex items-center justify-between text-xs pt-2.5 sm:pt-3 border-t border-[#111111]/10">
                    <span>14 Obras Concluídas</span>
                    <span className="font-semibold text-[#111111]">Confirmado</span>
                  </div>
                </div>

                {/* Card 2: XP Perpétuo */}
                <div className="rounded-2xl border border-[var(--landing-border)] bg-[var(--landing-bg)] p-4 sm:p-5 flex flex-col justify-between">
                  <div>
                    <span className="text-[11px] sm:text-xs uppercase tracking-wider text-[var(--landing-muted)] font-mono">XP Perpétuo</span>
                    <div className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-bold tracking-tight text-[var(--landing-fg)]">7.840 XP</div>
                  </div>
                  <div className="mt-3 sm:mt-4 flex items-center justify-between text-xs text-[var(--landing-muted)] pt-2.5 sm:pt-3 border-t border-[var(--landing-border)]">
                    <span>Ranking Brasil</span>
                    <span className="font-mono font-semibold text-[var(--landing-fg)]">TOP 3%</span>
                  </div>
                </div>

                {/* Card 3: Saldo da Loja */}
                <div className="rounded-2xl border border-[var(--landing-border)] bg-[var(--landing-bg)] p-4 sm:p-5 flex flex-col justify-between">
                  <div>
                    <span className="text-[11px] sm:text-xs uppercase tracking-wider text-[var(--landing-muted)] font-mono">Créditos OPE</span>
                    <div className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-bold tracking-tight text-[var(--landing-fg)]">1.450 $OPE</div>
                  </div>
                  <div className="mt-3 sm:mt-4 flex items-center justify-between text-xs text-[var(--landing-muted)] pt-2.5 sm:pt-3 border-t border-[var(--landing-border)]">
                    <span>Resgate Liberado</span>
                    <span className="font-semibold text-[var(--landing-fg)]">Frete Grátis</span>
                  </div>
                </div>
              </div>

              {/* Bottom Showcase: Live Leitor & Feed Combined */}
              <div className="grid gap-3.5 sm:gap-4 grid-cols-1 md:grid-cols-2">
                {/* Leitor Mockup Mini */}
                <div className="group relative rounded-2xl border border-[var(--landing-border)] bg-[var(--landing-bg)] p-4 sm:p-5 flex flex-col justify-between transition-all duration-300 hover:border-[var(--landing-brand)]/40">
                  <div>
                    <div className="flex items-center justify-between text-xs text-[var(--landing-muted)] pb-2.5 sm:pb-3 border-b border-[var(--landing-border)]">
                      <div className="flex items-center gap-2 font-medium text-[var(--landing-fg)]">
                        <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span>Leitor Nativo</span>
                      </div>
                      <span className="font-mono text-[10px] text-[var(--landing-muted)] truncate max-w-[180px]">
                        F. Nietzsche • Além do Bem e do Mal
                      </span>
                    </div>
                    <div className="mt-3.5 sm:mt-4 pl-3 border-l-2 border-[var(--landing-brand)]/60">
                      <blockquote className="font-['Newsreader',_Georgia,_serif] text-[15px] sm:text-[16px] italic leading-relaxed text-[var(--landing-fg)]">
                        “Quem luta com monstros deve velar para não se transformar também em monstro. E se tu olhares muito tempo para um abismo, o abismo também olhará para ti.”
                      </blockquote>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-[11px] text-[var(--landing-muted)] pt-2.5 border-t border-[var(--landing-border)]">
                    <span className="flex items-center gap-1.5">
                      <Bookmark className="size-3 text-[var(--landing-brand)]" />
                      Aforismo 146 • Sessão ativa
                    </span>
                    <span className="font-mono font-medium text-[var(--landing-fg)]">
                      +20 min lidos
                    </span>
                  </div>
                </div>

                {/* Feed Mockup Mini */}
                <div className="group relative rounded-2xl border border-[var(--landing-border)] bg-[var(--landing-bg)] p-4 sm:p-5 flex flex-col justify-between transition-all duration-300 hover:border-[var(--landing-brand)]/40">
                  <div>
                    <div className="flex items-center justify-between text-xs text-[var(--landing-muted)] pb-2.5 sm:pb-3 border-b border-[var(--landing-border)]">
                      <div className="flex items-center gap-2 font-medium text-[var(--landing-fg)]">
                        <MessageSquare className="size-3.5 text-[var(--landing-brand)]" />
                        <span>Comunidade &amp; Diálogos</span>
                      </div>
                      <span className="font-mono text-[10px] text-[var(--landing-muted)]">
                        Discussão em alta
                      </span>
                    </div>
                    <div className="mt-3 sm:mt-3.5">
                      <div className="flex items-center gap-2">
                        <div className="flex size-6 items-center justify-center rounded-full bg-[var(--landing-hover)] border border-[var(--landing-border)] font-mono text-[10px] font-bold text-[var(--landing-fg)]">
                          H
                        </div>
                        <span className="font-semibold text-xs text-[var(--landing-fg)]">Henrique S.</span>
                        <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[9px] font-mono text-[var(--landing-muted)]">
                          Nv. 24 Pensador
                        </span>
                      </div>
                      <p className="mt-2 text-xs sm:text-[13px] leading-relaxed text-[var(--landing-fg)]/90 line-clamp-2">
                        “A resposta de Camus ao absurdo não é desistir, mas viver com paixão e revolta lúcida. A liberdade real surge ao aceitar a brevidade da vida.”
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-[11px] text-[var(--landing-muted)] pt-2.5 border-t border-[var(--landing-border)]">
                    <span>28 respostas no tópico</span>
                    <span className="font-mono font-medium text-[var(--landing-brand)]">
                      +45 XP recebidos
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Micro Footer */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs text-[var(--landing-muted)]">
                <span className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-[var(--landing-brand)]" />
                  Ambiente imersivo sem anúncios e sem distrações tóxicas
                </span>
                <Link
                  to="/entrar"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--landing-fg)] hover:text-[var(--landing-brand)] transition-colors"
                >
                  Experimentar plataforma
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const shopProducts = [
  {
    title: "Edições Especiais",
    desc: "Livros clássicos e coleções nobres.",
    image: "https://http2.mlstatic.com/D_NQ_NP_2X_616707-MLA95645759960_102025-F.webp",
  },
  {
    title: "Tratados Filosóficos",
    desc: "Filosofia e literatura em capa dura.",
    image: "https://http2.mlstatic.com/D_NQ_NP_2X_939221-MLA100846856238_122025-F.webp",
  },
  {
    title: "Boxes & Coleções",
    desc: "Edições de luxo e coleções completas.",
    image: "https://http2.mlstatic.com/D_NQ_NP_2X_664970-MLA112247816123_052026-F.webp",
  },
  {
    title: "Edições Selecionadas",
    desc: "Livros físicos para membros do clube.",
    image: "https://http2.mlstatic.com/D_NQ_NP_2X_979425-MLA105576395728_012026-F.webp",
  },
  {
    title: "Obras Essenciais",
    desc: "Acervo de literatura e filosofia.",
    image: "https://http2.mlstatic.com/D_NQ_NP_2X_735527-MLA84467669062_052025-F.webp",
  },
  {
    title: "Edições de Autor",
    desc: "Camus, Dostoiévski e Nietzsche.",
    image: "https://http2.mlstatic.com/D_NQ_NP_2X_707949-MLA93662893200_102025-F.webp",
  },
  {
    title: "Moletom Thanatos",
    desc: "Moletom pesado com estampa conceitual.",
    image: "/shop/moletom-thanatos.png",
  },
  {
    title: "Moletom Miracles",
    desc: "Moletom sand com bordado e citação.",
    image: "/shop/moletom-miracles.jpg",
  },
  {
    title: "Camiseta Miracles",
    desc: "Camiseta oversized 260g preta.",
    image: "/shop/camiseta-miracles.png",
  },
  {
    title: "Camiseta Memento Mori",
    desc: "Camiseta oversized off-white.",
    image: "/shop/camiseta-memento.png",
  },
];

export function LandingGamificationShop() {
  return (
    <section id="loja-xp" className="relative border-t border-[var(--landing-border)] bg-[var(--landing-section)] py-14 sm:py-20 md:py-28">
      <div className="mx-auto w-full max-w-[1280px] px-4 sm:px-6">
        {/* Section Header */}
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-[clamp(1.8rem,4vw,3rem)] font-medium leading-tight tracking-tight text-[var(--landing-fg)] text-balance">
            Como funciona o XP e a Loja
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-[14px] sm:text-[15px] leading-relaxed text-[var(--landing-muted)]">
            Leia no seu ritmo, acumule pontos e troque por livros e peças exclusivas entregues na sua casa.
          </p>
        </div>

        {/* Compact 2-Card Row */}
        <div className="mt-8 sm:mt-12 grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2">
          {/* Card 1: XP */}
          <div
            className="group relative flex flex-col justify-between rounded-2xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-5 sm:p-7 transition-all duration-300 hover:border-[var(--landing-brand)]/40"
            style={{
              backgroundImage: "radial-gradient(ellipse at 31% -7%, rgba(255,255,255,0.06), transparent)",
            }}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="flex size-9 items-center justify-center rounded-xl bg-[var(--landing-brand)] font-mono text-xs font-bold text-[var(--landing-brand-fg)]">
                  XP
                </span>
                <span className="text-[11px] font-mono text-[var(--landing-muted)]">
                  Sem Expirar
                </span>
              </div>
              <h3 className="mt-5 text-lg sm:text-xl font-semibold tracking-tight text-[var(--landing-fg)]">
                Progresso na Leitura
              </h3>
              <p className="mt-2 text-xs sm:text-sm leading-relaxed text-[var(--landing-muted)]">
                A cada 10 minutos lendo no aplicativo você ganha XP para acompanhar seu histórico e evolução dentro da comunidade.
              </p>
            </div>
            <div className="mt-5 pt-4 border-t border-[var(--landing-border)] flex items-center justify-between text-xs text-[var(--landing-muted)]">
              <span>+15 XP a cada sessão</span>
              <span className="font-mono text-[var(--landing-fg)] text-[11px]">Automático no app</span>
            </div>
          </div>

          {/* Card 2: Créditos OPE */}
          <div
            className="group relative flex flex-col justify-between rounded-2xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-5 sm:p-7 transition-all duration-300 hover:border-[var(--landing-brand)]/40"
            style={{
              backgroundImage: "radial-gradient(ellipse at 31% -7%, rgba(255,255,255,0.06), transparent)",
            }}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="flex size-9 items-center justify-center rounded-xl border border-[var(--landing-brand)]/40 bg-[var(--landing-hover)] font-mono text-xs font-bold text-[var(--landing-brand)]">
                  $OPE
                </span>
                <span className="text-[11px] font-mono text-[var(--landing-muted)]">
                  Frete Grátis Brasil
                </span>
              </div>
              <h3 className="mt-5 text-lg sm:text-xl font-semibold tracking-tight text-[var(--landing-fg)]">
                Créditos para a Loja
              </h3>
              <p className="mt-2 text-xs sm:text-sm leading-relaxed text-[var(--landing-muted)]">
                Seu tempo de leitura e participação nas discussões viram moedas $OPE para resgatar itens físicos sem custo de envio.
              </p>
            </div>
            <div className="mt-5 pt-4 border-t border-[var(--landing-border)] flex items-center justify-between text-xs text-[var(--landing-muted)]">
              <span>Livros • Roupas • Drops</span>
              <span className="font-mono text-[var(--landing-fg)] text-[11px]">Entrega nacional</span>
            </div>
          </div>
        </div>

        {/* Clean Showcase with Touch Horizontal Scroll on Mobile & Responsive Grid on Desktop */}
        <div className="mt-10 sm:mt-12 overflow-hidden rounded-2xl sm:rounded-3xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-4 sm:p-6 lg:p-8 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--landing-border)] pb-4 sm:pb-5">
            <div>
              <h4 className="text-base sm:text-xl font-semibold tracking-tight text-[var(--landing-fg)]">
                Loja Oficial OPE
              </h4>
              <p className="text-xs sm:text-sm text-[var(--landing-muted)]">
                Itens exclusivos para membros resgatarem com créditos e frete grátis
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 self-start sm:self-center rounded-full border border-[var(--landing-border)] bg-[var(--landing-hover)] px-3 py-1 font-mono text-[11px] font-medium text-[var(--landing-brand)]">
              <Sparkles className="size-3 text-[var(--landing-brand)]" />
              Novos livros e peças a cada Season
            </span>
          </div>

          {/* Horizontal Scroll on Mobile / Multi-column Grid on Desktop */}
          <div className="mt-5 sm:mt-6 flex gap-3.5 sm:gap-4 overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] pb-2 -mx-1 px-1 sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 sm:overflow-visible sm:pb-0">
            {shopProducts.map((product) => (
              <div
                key={product.title}
                className="group relative flex w-[190px] sm:w-auto shrink-0 snap-start flex-col overflow-hidden rounded-xl sm:rounded-2xl border border-[var(--landing-border)] bg-[var(--landing-bg)] p-3 transition-all duration-300 hover:border-[var(--landing-brand)]/50"
              >
                <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-black/60 flex items-center justify-center">
                  <img
                    src={product.image}
                    alt={product.title}
                    className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-30 pointer-events-none" />
                </div>
                <div className="mt-3">
                  <h5 className="text-xs sm:text-sm font-semibold text-[var(--landing-fg)] line-clamp-1">{product.title}</h5>
                  <p className="mt-1 text-[11px] sm:text-xs leading-relaxed text-[var(--landing-muted)] line-clamp-1">
                    {product.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
