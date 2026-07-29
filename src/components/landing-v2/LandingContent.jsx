import { AtSign, BookMarked, Compass, CreditCard, LogIn, MessageCircle, MessagesSquare, WifiOff } from "lucide-react";

const features = [
  { icon: BookMarked, title: "Biblioteca", text: "Leia grandes obras de filosofia, literatura e psicologia diretamente no aplicativo." },
  { icon: MessagesSquare, title: "Comunidade integrada", text: "Publique reflexões, participe de discussões e interaja com outros leitores sem sair do aplicativo." },
  { icon: Compass, title: "Descobertas", text: "Encontre novos autores, livros e recomendações feitas pela própria comunidade." },
  { icon: WifiOff, title: "Leitura offline", text: "Baixe suas obras favoritas e leia onde quiser." },
];

const steps = [
  { icon: CreditCard, title: "Assine o OPE Club.", text: "Escolha o plano mensal ou anual e tenha acesso ao conteúdo." },
  { icon: LogIn, title: "Receba acesso imediato.", text: "Entre no aplicativo e comece a explorar a biblioteca e a comunidade." },
  { icon: MessageCircle, title: "Leia, participe e descubra.", text: "Acesse livros, publique reflexões e converse com outros leitores todos os dias." },
];

export function LandingAbout() {
  return (
    <section id="sobre" className="bg-[var(--landing-bg)] py-20 md:py-28">
      <div className="mx-auto grid w-full max-w-[1200px] items-center gap-12 px-6 md:grid-cols-[minmax(0,340px)_minmax(0,1fr)] md:gap-16">
        <article className="rounded-[8px] border border-[var(--landing-border)] bg-[var(--landing-surface)] p-8 text-center">
          <img
            src="/gabe-nescau.jpg"
            alt="Gabe Nescau, criador do OPE Club"
            className="mx-auto size-28 rounded-full border border-[var(--landing-brand)]/30 object-cover"
          />
          <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--landing-brand)]">Criador do app</p>
          <h3 className="mt-2 text-xl font-semibold text-[var(--landing-fg)]">Gabe Nescau</h3>
          <p className="mt-1 text-sm text-[var(--landing-muted)]">Desenvolvedor &amp; leitor</p>
          <a
            href="https://www.instagram.com/gabenescau/"
            target="_blank"
            rel="noreferrer"
            className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(110deg,var(--landing-brand-strong),var(--landing-brand))] px-5 font-mono text-[11px] uppercase tracking-[0.14em] text-white"
          >
            <AtSign className="size-3.5" />
            Acessar perfil
          </a>
        </article>

        <div>
          <h2 className="text-[clamp(1.9rem,5vw,3rem)] font-semibold leading-[1.08] text-[var(--landing-fg)]">
            O que é o OPE Club e por que ele foi criado?
          </h2>
          <div className="mt-6 space-y-5 text-[15px] leading-7 text-[var(--landing-muted)]">
            <p>O OPE Club não é apenas uma biblioteca digital. É um ecossistema projetado para transformar a leitura solitária em uma experiência viva e compartilhada de filosofia e literatura.</p>
            <p>Criado por <span className="font-medium text-[var(--landing-brand)]">Gabe Nescau</span>, o aplicativo nasceu do desejo de solucionar a frieza dos leitores digitais convencionais e aproximar pessoas que querem conversar sobre as mesmas páginas.</p>
            <p>O clube reúne no mesmo lugar um acervo curado de livros clássicos e uma comunidade ativa, onde cada leitura pode virar uma conversa.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function LandingFeatures() {
  return (
    <section id="recursos" className="bg-[var(--landing-bg)] py-20 md:py-28">
      <div className="mx-auto w-full max-w-[1200px] px-6">
        <p className="text-center font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--landing-muted)]">Dentro do aplicativo</p>
        <h2 className="mx-auto mt-4 max-w-2xl text-center text-[clamp(1.9rem,5vw,3rem)] font-semibold leading-[1.1] text-[var(--landing-fg)]">
          O que você encontra dentro do aplicativo
        </h2>
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <article key={feature.title} className="rounded-[8px] border border-[var(--landing-border)] bg-[var(--landing-surface)] p-6 transition-colors hover:border-[var(--landing-brand)]/40">
              <feature.icon className="size-5 text-[var(--landing-muted)]" />
              <h3 className="mt-6 text-lg font-semibold text-[var(--landing-fg)]">{feature.title}</h3>
              <p className="mt-3 text-sm leading-6 text-[var(--landing-muted)]">{feature.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LandingSteps() {
  return (
    <section className="bg-[var(--landing-bg)] py-20 md:py-28">
      <div className="mx-auto w-full max-w-[1200px] px-6">
        <p className="text-center font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--landing-muted)]">Como funciona</p>
        <h2 className="mt-4 text-center text-[clamp(1.9rem,5vw,3rem)] font-semibold text-[var(--landing-fg)]">Simples como ler um livro.</h2>
        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {steps.map((step, index) => (
            <article key={step.title} className="rounded-[8px] border border-[var(--landing-border)] bg-[var(--landing-surface)] p-7">
              <span className="flex size-11 items-center justify-center rounded-full border border-[var(--landing-brand)]/30 bg-[var(--landing-hover)] text-[var(--landing-brand)]">
                <step.icon className="size-4" />
              </span>
              <h3 className="mt-14 text-base font-semibold text-[var(--landing-fg)]">
                <span className="mr-2 text-[var(--landing-brand)]">{index + 1}.</span>
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-[var(--landing-muted)]">{step.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
