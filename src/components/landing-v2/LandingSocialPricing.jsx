import { Link } from "react-router-dom";
import { ArrowRight, ChevronDown, WhatsappLogo, Mail, AtSign } from "@/lib/icons";
import { useAuth } from "@/app/data/AuthContext";
import { PLANS } from "@/lib/abacatepay";
import { faqs, testimonials } from "./data";
import { PlanBenefitList } from "@/components/plan-benefit";
import { Logo } from "@/components/logo";

const WHATSAPP_SUPPORT_URL =
  "https://wa.me/?text=Ol%C3%A1%2C%20Gabe!%20Tenho%20uma%20d%C3%BAvida%20sobre%20o%20OPE%20Club.";

function TestimonialCard({ testimonial }) {
  return (
    <figure
      className="rounded-2xl sm:rounded-3xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-5 sm:p-7 transition-all duration-300 hover:border-[var(--landing-brand)]/40 shadow-sm"
      style={{
        backgroundImage: "radial-gradient(ellipse at 31% -7%, rgba(255,255,255,0.06), transparent)",
      }}
    >
      <blockquote className="text-[14px] sm:text-[15px] italic leading-relaxed text-[var(--landing-fg)]">“{testimonial.quote}”</blockquote>
      <figcaption className="mt-4 sm:mt-5 flex items-center gap-3">
        <span className="flex size-8 sm:size-9 items-center justify-center rounded-full bg-[var(--landing-hover)] border border-[var(--landing-border)] font-mono text-xs font-semibold text-[var(--landing-fg)]">
          {testimonial.name.charAt(0)}
        </span>
        <span>
          <span className="block text-xs sm:text-sm font-semibold tracking-tight text-[var(--landing-fg)]">{testimonial.name}</span>
          <span className="block text-[11px] sm:text-xs text-[var(--landing-muted)]">{testimonial.meta}</span>
        </span>
      </figcaption>
    </figure>
  );
}

function TestimonialColumn({ items, duration }) {
  const loop = [...items, ...items, ...items];
  return (
    <div className="relative h-[480px] sm:h-[510px] overflow-hidden">
      <div className="landing-marquee-up flex flex-col gap-4 sm:gap-5" style={{ "--landing-marquee-duration": duration }}>
        {loop.map((testimonial, index) => (
          <TestimonialCard key={`${testimonial.name}-${index}`} testimonial={testimonial} />
        ))}
      </div>
    </div>
  );
}

export function LandingTestimonials() {
  const allTestimonials = [...testimonials[0], ...testimonials[1], ...testimonials[2]];

  return (
    <section id="depoimentos" className="relative overflow-hidden border-t border-[var(--landing-border)] bg-[var(--landing-bg)] py-16 sm:py-24 md:py-32">
      <div className="mx-auto w-full max-w-[1280px] px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-[clamp(1.9rem,4.5vw,3.3rem)] font-medium leading-tight tracking-tight text-[var(--landing-fg)] text-balance">
            O que dizem os membros da comunidade.
          </h2>
        </div>

        {/* Desktop 3 Columns */}
        <div className="relative mt-10 sm:mt-16 hidden md:grid gap-6 md:grid-cols-3">
          <TestimonialColumn items={testimonials[0]} duration="34s" />
          <TestimonialColumn items={testimonials[1]} duration="42s" />
          <TestimonialColumn items={testimonials[2]} duration="38s" />
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 hidden h-24 bg-gradient-to-b from-[var(--landing-bg)] to-transparent md:block" />
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-24 bg-gradient-to-t from-[var(--landing-bg)] to-transparent md:block" />
        </div>

        {/* Mobile Single Marquee Column */}
        <div className="relative mt-8 block md:hidden">
          <TestimonialColumn items={allTestimonials} duration="40s" />
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-[var(--landing-bg)] to-transparent" />
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[var(--landing-bg)] to-transparent" />
        </div>
      </div>
    </section>
  );
}

export function LandingPricing() {
  const { isAuthenticated } = useAuth();
  const destination = isAuthenticated ? "/assinar" : "/entrar";

  return (
    <section id="planos" className="border-t border-[var(--landing-border)] bg-[var(--landing-bg)] py-16 sm:py-24 md:py-32">
      <div className="mx-auto w-full max-w-[1280px] px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-[clamp(1.9rem,4.5vw,3.3rem)] font-medium leading-tight tracking-tight text-[var(--landing-fg)] text-balance">
            Escolha seu plano e faça parte do clube.
          </h2>
        </div>

        <div className="mx-auto mt-10 sm:mt-16 grid w-full max-w-[940px] gap-6 sm:gap-8 md:grid-cols-2">
          {Object.values(PLANS).map((plan) => {
            const isPensador = plan.id === "annual";
            return (
              <article
                key={plan.id}
                className={`relative flex flex-col rounded-2xl sm:rounded-3xl border bg-[var(--landing-surface)] p-2 transition-all duration-300 ${
                  isPensador
                    ? "border-[var(--landing-brand)] shadow-2xl"
                    : "border-[var(--landing-border)] shadow-lg"
                }`}
                style={{
                  backgroundImage: "radial-gradient(ellipse at 31% -7%, rgba(255,255,255,0.06), transparent)",
                }}
              >
                {isPensador && (
                  <span className="absolute -top-3 left-6 sm:left-8 rounded-full bg-[var(--landing-brand)] px-3 sm:px-3.5 py-1 font-mono text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--landing-brand-fg)] shadow-md">
                    {plan.discountText}
                  </span>
                )}
                <div className="border-b border-[var(--landing-border)] p-5 sm:p-7 md:p-8">
                  <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--landing-fg)]">{plan.label}</h3>
                  <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm leading-relaxed text-[var(--landing-muted)]">{plan.description}</p>
                  <p className="mt-5 sm:mt-6 flex items-baseline gap-1">
                    <span className="text-base sm:text-lg font-medium text-[var(--landing-fg)]">R$</span>
                    <span className="text-4xl sm:text-5xl font-bold tracking-tight text-[var(--landing-fg)]">
                      {plan.price / 100}
                    </span>
                    <span className="text-xs sm:text-sm text-[var(--landing-muted)]">/mês</span>
                  </p>
                  <p className="mt-2 text-[11px] sm:text-xs text-[var(--landing-muted)]">
                    Cancele a qualquer momento sem taxa ou burocracia
                  </p>
                </div>
                <ul className="space-y-3 p-5 sm:p-7 md:p-8">
                  <PlanBenefitList
                    benefits={plan.benefits}
                    separator={isPensador}
                    showCheck={false}
                    itemClassName="flex items-center gap-2.5 sm:gap-3 text-xs sm:text-sm text-[var(--landing-fg)]"
                  />
                </ul>
                <div className="mt-auto border-t border-[var(--landing-border)] p-4 sm:p-5">
                  <Link
                    to={destination}
                    className="flex min-h-12 sm:min-h-13 w-full items-center justify-center rounded-xl bg-[var(--landing-brand)] px-6 text-xs font-semibold uppercase tracking-wider text-[var(--landing-brand-fg)] transition-all hover:brightness-95 shadow-md text-center"
                  >
                    Assinar {plan.label}
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function LandingFaq() {
  return (
    <section id="faq" className="border-t border-[var(--landing-border)] bg-[var(--landing-bg)] py-16 sm:py-24 md:py-32">
      <div className="mx-auto w-full max-w-[800px] px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-[clamp(1.9rem,4.5vw,3.3rem)] font-medium leading-tight tracking-tight text-[var(--landing-fg)] text-balance">
            Perguntas Frequentes
          </h2>
          <p className="mt-3.5 sm:mt-4 text-[14px] sm:text-[16px] leading-relaxed text-[var(--landing-muted)]">
            Tudo o que você precisa saber sobre o funcionamento do clube e das recompensas.
          </p>
        </div>

        <div className="mt-10 sm:mt-14 space-y-3.5 sm:space-y-4">
          {faqs.map((faq) => (
            <details
              key={faq.q}
              className="group rounded-2xl border border-[var(--landing-border)] bg-[var(--landing-surface)] px-4 sm:px-6 transition-all duration-200 hover:border-[var(--landing-brand)]/40"
              style={{
                backgroundImage: "radial-gradient(ellipse at 31% -7%, rgba(255,255,255,0.04), transparent)",
              }}
            >
              <summary className="flex min-h-12 sm:min-h-14 cursor-pointer list-none items-center justify-between gap-3 sm:gap-4 py-3.5 sm:py-4 text-xs sm:text-[15px] font-medium text-[var(--landing-fg)]">
                <span>{faq.q}</span>
                <ChevronDown className="size-4 shrink-0 transition-transform duration-300 group-open:rotate-180 text-[var(--landing-muted)]" />
              </summary>
              <p className="pb-4 sm:pb-6 text-xs sm:text-sm leading-relaxed text-[var(--landing-muted)]">{faq.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LandingSupport() {
  return (
    <footer id="suporte" className="border-t border-[var(--landing-border)] bg-[var(--landing-section)] pt-14 sm:pt-16 pb-12">
      <div className="mx-auto w-full max-w-[1280px] px-4 sm:px-6">
        {/* Main Footer Row */}
        <div className="grid gap-10 sm:gap-12 md:grid-cols-12 pb-12 border-b border-[var(--landing-border)]">
          {/* Col 1: Brand & Tagline */}
          <div className="md:col-span-5 space-y-4">
            <a href="#top" className="inline-block text-[var(--landing-fg)] transition-opacity hover:opacity-80">
              <Logo className="text-[20px] leading-[0.88]" />
            </a>
            <p className="max-w-sm text-xs sm:text-sm leading-relaxed text-[var(--landing-muted)]">
              O maior ecossistema de filosofia e literatura do Brasil. Leitura nativa, comunidade de pensadores e recompensas exclusivas.
            </p>
            <div className="pt-2 flex items-center gap-3">
              <a
                href="https://www.instagram.com/gabenescau/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] px-3.5 py-2 text-xs font-medium text-[var(--landing-fg)] hover:border-[var(--landing-brand)]/50 transition-colors"
              >
                <AtSign className="size-3.5 text-[var(--landing-muted)]" />
                <span>@gabenescau</span>
              </a>
              <a
                href="https://www.instagram.com/ope.club/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--landing-border)] bg-[var(--landing-surface)] px-3.5 py-2 text-xs font-medium text-[var(--landing-fg)] hover:border-[var(--landing-brand)]/50 transition-colors"
              >
                <AtSign className="size-3.5 text-[var(--landing-muted)]" />
                <span>@ope.club</span>
              </a>
            </div>
          </div>

          {/* Col 2: Navigation Links */}
          <div className="md:col-span-3 space-y-3">
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-[var(--landing-fg)]">
              Navegação
            </span>
            <ul className="space-y-2 text-xs sm:text-sm text-[var(--landing-muted)]">
              <li>
                <a href="#ecossistema" className="hover:text-[var(--landing-fg)] transition-colors">Ecossistema</a>
              </li>
              <li>
                <a href="#biblioteca" className="hover:text-[var(--landing-fg)] transition-colors">Biblioteca</a>
              </li>
              <li>
                <a href="#loja-xp" className="hover:text-[var(--landing-fg)] transition-colors">Loja &amp; XP</a>
              </li>
              <li>
                <a href="#autores" className="hover:text-[var(--landing-fg)] transition-colors">Autores</a>
              </li>
              <li>
                <a href="#sobre" className="hover:text-[var(--landing-fg)] transition-colors">Manifesto do Criador</a>
              </li>
              <li>
                <a href="#planos" className="hover:text-[var(--landing-fg)] transition-colors">Planos &amp; Assinatura</a>
              </li>
            </ul>
          </div>

          {/* Col 3: Support & Contact */}
          <div className="md:col-span-4 space-y-4">
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-[var(--landing-fg)]">
              Suporte &amp; Atendimento
            </span>
            <p className="text-xs sm:text-sm text-[var(--landing-muted)]">
              Dúvidas sobre o acesso, acervo de livros ou entrega de produtos?
            </p>
            <div className="space-y-2.5">
              <a
                href={WHATSAPP_SUPPORT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full sm:w-auto items-center justify-center gap-2.5 rounded-xl bg-[#25D366] px-5 py-2.5 text-xs font-semibold text-black transition-all hover:brightness-95 shadow-sm"
              >
                <WhatsappLogo className="size-4" weight="fill" />
                <span>Suporte via WhatsApp</span>
              </a>

              <div className="flex items-center gap-2 text-xs text-[var(--landing-muted)] pt-1">
                <Mail className="size-3.5 text-[var(--landing-fg)] shrink-0" />
                <span>Email:</span>
                <a
                  href="mailto:gabenescau@gmail.com"
                  className="font-mono font-medium text-[var(--landing-fg)] hover:underline"
                >
                  gabenescau@gmail.com
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Credits & Copyright */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--landing-muted)]">
          <p className="text-center sm:text-left">
            © {new Date().getFullYear()} OPE Club. Todos os direitos reservados a <span className="text-[var(--landing-fg)] font-medium">Gabe Nescau</span>.
          </p>

          <div className="flex items-center gap-6">
            <a href="mailto:gabenescau@gmail.com" className="hover:text-[var(--landing-fg)] transition-colors">
              Suporte Direto
            </a>
            <a href="#top" className="hover:text-[var(--landing-fg)] transition-colors">
              Voltar ao topo ↑
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
