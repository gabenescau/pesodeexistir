import { bookCovers, landingAuthors } from "./data";

function CoverRow({ covers, reverse = false }) {
  const loop = [...covers, ...covers];
  return (
    <div className="flex overflow-hidden" aria-label="Capas do acervo">
      <div className={`flex w-max gap-3 sm:gap-4 pr-3 sm:pr-4 ${reverse ? "landing-marquee-right" : "landing-marquee-left"}`}>
        {loop.map((src, index) => (
          <img
            key={`${src}-${index}`}
            src={src}
            alt={index < covers.length ? "Capa de livro do acervo OPE Club" : ""}
            aria-hidden={index >= covers.length}
            loading="lazy"
            className="h-[180px] w-[120px] sm:h-[250px] sm:w-[170px] shrink-0 rounded-xl sm:rounded-2xl object-cover shadow-lg border border-white/10 transition-transform duration-300 hover:scale-105"
          />
        ))}
      </div>
    </div>
  );
}

export function LandingLibrary() {
  return (
    <section id="biblioteca" className="relative overflow-hidden border-b border-[var(--landing-border)] bg-[var(--landing-section)] py-16 sm:py-24 md:py-32">
      <div className="mx-auto mb-10 sm:mb-14 max-w-3xl px-4 sm:px-6 text-center">
        <h2 className="text-[clamp(1.9rem,4.5vw,3.3rem)] font-medium leading-tight tracking-tight text-[var(--landing-fg)] text-balance">
          Uma biblioteca viva em constante expansão.
        </h2>
        <p className="mx-auto mt-3.5 sm:mt-4 max-w-2xl text-[14px] sm:text-[16px] leading-relaxed text-[var(--landing-muted)]">
          Centenas de clássicos da literatura mundial e tratados filosóficos disponíveis direto no aplicativo, sem necessidade de baixar PDFs.
        </p>
      </div>

      <div className="flex flex-col gap-3.5 sm:gap-5">
        <CoverRow covers={bookCovers.slice(0, 15)} />
        <CoverRow covers={bookCovers.slice(15)} reverse />
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-16 sm:w-24 bg-gradient-to-r from-[var(--landing-section)] to-transparent md:w-56" />
      <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-16 sm:w-24 bg-gradient-to-l from-[var(--landing-section)] to-transparent md:w-56" />
    </section>
  );
}

function AuthorCard({ author }) {
  return (
    <article className="group relative h-[380px] w-[260px] sm:h-[440px] sm:w-[310px] shrink-0 snap-start overflow-hidden rounded-2xl sm:rounded-3xl border border-[var(--landing-border)] bg-[var(--landing-surface)] transition-all duration-300 hover:border-[var(--landing-brand)]/50 hover:shadow-2xl">
      <img
        src={encodeURI(author.image)}
        alt={`Retrato de ${author.name}`}
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover grayscale transition-all duration-700 group-hover:scale-105 group-hover:grayscale-0"
      />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-black/10" />
      
      <span className="absolute left-4 top-4 sm:left-5 sm:top-5 rounded-full border border-white/20 bg-black/60 px-3 py-0.5 sm:px-3.5 sm:py-1 text-[10px] sm:text-[11px] font-medium text-white backdrop-blur-md">
        {author.school}
      </span>

      <div className="absolute inset-x-4 bottom-4 sm:inset-x-6 sm:bottom-6">
        <h3 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">{author.name}</h3>
        <div className="mt-2.5 sm:mt-3 flex flex-wrap gap-1.5 sm:gap-2">
          {author.themes.map((theme) => (
            <span key={theme} className="rounded-lg sm:rounded-xl border border-white/15 bg-white/10 px-2.5 py-0.5 sm:px-3 sm:py-1 text-[11px] sm:text-xs text-white/90 backdrop-blur-md">
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
    <section id="autores" className="border-t border-[var(--landing-border)] bg-[var(--landing-bg)] py-16 sm:py-24 md:py-32">
      <div className="mx-auto w-full max-w-[1280px] px-4 sm:px-6">
        <div className="text-center">
          <h2 className="text-[clamp(1.9rem,4.5vw,3.3rem)] font-medium leading-tight tracking-tight text-[var(--landing-fg)] text-balance">
            Grandes pensadores ao seu alcance.
          </h2>
          <p className="mx-auto mt-3.5 sm:mt-4 max-w-2xl text-[14px] sm:text-[16px] leading-relaxed text-[var(--landing-muted)]">
            Explore as obras e os tratados fundamentais dos filósofos e romancistas que marcaram a história.
          </p>
        </div>
      </div>

      <div className="mt-10 sm:mt-16 hidden snap-x gap-6 overflow-x-auto px-6 pb-4 [scrollbar-width:none] md:flex [&::-webkit-scrollbar]:hidden justify-center">
        {landingAuthors.map((author) => <AuthorCard key={author.name} author={author} />)}
      </div>
      <div className="mt-10 sm:mt-16 overflow-x-auto px-4 pb-4 md:hidden flex gap-4 snap-x snap-mandatory [scrollbar-width:none]">
        {landingAuthors.map((author, index) => (
          <AuthorCard key={`${author.name}-${index}`} author={author} />
        ))}
      </div>
    </section>
  );
}
