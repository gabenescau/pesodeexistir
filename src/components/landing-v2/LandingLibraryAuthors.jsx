import { bookCovers, landingAuthors } from "./data";

function CoverRow({ covers, reverse = false }) {
  const loop = [...covers, ...covers];
  return (
    <div className="flex overflow-hidden" aria-label="Capas do acervo">
      <div className={`flex w-max gap-4 pr-4 ${reverse ? "landing-marquee-right" : "landing-marquee-left"}`}>
        {loop.map((src, index) => (
          <img
            key={`${src}-${index}`}
            src={src}
            alt={index < covers.length ? "Capa de livro do acervo OPE Club" : ""}
            aria-hidden={index >= covers.length}
            loading="lazy"
            className="h-[220px] w-[148px] shrink-0 rounded-[6px] object-cover shadow-lg sm:h-[260px] sm:w-[176px]"
          />
        ))}
      </div>
    </div>
  );
}

export function LandingLibrary() {
  return (
    <section id="biblioteca" className="relative overflow-hidden bg-[var(--landing-section)] py-20 md:py-28">
      <div className="mx-auto mb-12 max-w-3xl px-6 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--landing-muted)]">Biblioteca</p>
        <h2 className="mt-4 text-[clamp(1.9rem,5vw,3rem)] font-semibold leading-[1.1] text-[var(--landing-fg)]">
          Uma biblioteca em constante crescimento.
        </h2>
      </div>

      <div className="flex flex-col gap-4">
        <CoverRow covers={bookCovers.slice(0, 15)} />
        <CoverRow covers={bookCovers.slice(15)} reverse />
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-[var(--landing-section)] to-transparent md:w-40" />
      <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[var(--landing-section)] to-transparent md:w-40" />
    </section>
  );
}

function AuthorCard({ author }) {
  return (
    <article className="relative h-[420px] w-[300px] shrink-0 snap-start overflow-hidden rounded-[8px] border border-[var(--landing-border)]">
      <img
        src={encodeURI(author.image)}
        alt={`Retrato de ${author.name}`}
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover grayscale"
      />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-black/15" />
      <span className="absolute left-5 top-5 rounded-[6px] border border-[#c78359]/60 bg-black/45 px-2 py-1 text-[11px] text-[#d89567]">
        {author.school}
      </span>
      <div className="absolute inset-x-5 bottom-5">
        <h3 className="text-xl font-medium text-white">{author.name}</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {author.themes.map((theme) => (
            <span key={theme} className="rounded-[5px] border border-white/20 bg-white/5 px-2 py-1 text-[11px] text-white/80">
              {theme}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}

export function LandingAuthors() {
  return (
    <section id="autores" className="overflow-hidden bg-[var(--landing-bg)] py-20 md:py-28">
      <div className="mx-auto w-full max-w-[1200px] px-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--landing-muted)]">Os autores</p>
        <h2 className="mt-4 max-w-2xl text-[clamp(1.9rem,5vw,3rem)] font-semibold leading-[1.08] text-[var(--landing-fg)]">
          Grandes mentes.
          <br />
          Uma única comunidade.
        </h2>
      </div>

      <div className="mt-12 hidden snap-x gap-5 overflow-x-auto px-6 pb-4 [scrollbar-width:none] md:flex [&::-webkit-scrollbar]:hidden">
        {landingAuthors.map((author) => <AuthorCard key={author.name} author={author} />)}
      </div>
      <div className="mt-12 overflow-hidden px-6 pb-4 md:hidden">
        <div className="landing-marquee-left flex w-max gap-5">
          {[...landingAuthors, ...landingAuthors].map((author, index) => (
            <AuthorCard key={`${author.name}-${index}`} author={author} />
          ))}
        </div>
      </div>
    </section>
  );
}
