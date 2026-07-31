import { Link } from "react-router-dom";
import { ArrowRight, ChevronDown, CircleCheck } from "@/lib/icons";
import { useAuth } from "@/app/data/AuthContext";
import { PLANS } from "@/lib/abacatepay";
import { faqs, testimonials } from "./data";
import { PlanBenefitItem } from "@/components/plan-benefit";

const WHATSAPP_SUPPORT_URL =
  "https://wa.me/?text=Ol%C3%A1%2C%20Gabe!%20Tenho%20uma%20d%C3%BAvida%20sobre%20o%20OPE%20Club.";

function WhatsAppBadge() {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white shadow-sm" aria-hidden="true">
      <svg viewBox="0 0 24 24" className="size-5 fill-current">
        <path d="M12.04 2a9.84 9.84 0 0 0-8.46 14.86L2 22l5.27-1.54A9.94 9.94 0 1 0 12.04 2Zm0 17.98a8 8 0 0 1-4.08-1.12l-.29-.17-3.13.92.94-3.05-.19-.31A7.98 7.98 0 1 1 12.04 20Zm4.39-5.98c-.24-.12-1.43-.7-1.65-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-.24-.12-1.01-.37-1.93-1.19a7.25 7.25 0 0 1-1.34-1.67c-.14-.24-.01-.37.11-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.19-.47-.39-.41-.54-.42h-.46a.88.88 0 0 0-.64.3c-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.69 2.58 4.1 3.62.57.25 1.02.39 1.37.5.58.18 1.1.16 1.51.1.46-.07 1.43-.59 1.63-1.15.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28Z" />
      </svg>
    </span>
  );
}

function TestimonialColumn({ items, duration }) {
  const loop = [...items, ...items, ...items];
  return (
    <div className="relative h-[510px] overflow-hidden">
      <div className="landing-marquee-up flex flex-col gap-5" style={{ "--landing-marquee-duration": duration }}>
        {loop.map((testimonial, index) => (
          <figure key={`${testimonial.name}-${index}`} className="rounded-[8px] border border-[var(--landing-border)] bg-[var(--landing-surface)] p-6">
            <blockquote className="text-[15px] italic leading-6 text-[var(--landing-fg)]">“{testimonial.quote}”</blockquote>
            <figcaption className="mt-5 flex items-center gap-3">
              <span className="flex size-8 items-center justify-center rounded-full border border-[var(--landing-brand)]/40 text-xs text-[var(--landing-brand)]">
                {testimonial.name.charAt(0)}
              </span>
              <span>
                <span className="block text-sm font-medium text-[var(--landing-fg)]">{testimonial.name}</span>
                <span className="block text-xs text-[var(--landing-muted)]">{testimonial.meta}</span>
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

export function LandingTestimonials() {
  return (
    <section id="depoimentos" className="relative overflow-hidden bg-[var(--landing-bg)] py-20 md:py-28">
      <div className="mx-auto w-full max-w-[1200px] px-6">
        <p className="text-center font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--landing-muted)]">Depoimentos</p>
        <h2 className="mt-4 text-center text-[clamp(1.9rem,5vw,3rem)] font-semibold text-[var(--landing-fg)]">Quem está dentro aprova.</h2>
        <div className="relative mt-14 grid gap-5 md:grid-cols-3">
          <TestimonialColumn items={testimonials[0]} duration="34s" />
          <TestimonialColumn items={testimonials[1]} duration="42s" />
          <TestimonialColumn items={testimonials[2]} duration="38s" />
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 hidden h-20 bg-gradient-to-b from-[var(--landing-bg)] to-transparent md:block" />
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-20 bg-gradient-to-t from-[var(--landing-bg)] to-transparent md:block" />
        </div>
      </div>
    </section>
  );
}

export function LandingPricing() {
  const { isAuthenticated } = useAuth();
  const destination = isAuthenticated ? "/assinar" : "/entrar";

  return (
    <section id="planos" className="bg-[var(--landing-bg)] py-20 md:py-28">
      <div className="mx-auto w-full max-w-[1200px] px-6">
        <p className="text-center font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--landing-muted)]">Planos</p>
        <h2 className="mx-auto mt-4 max-w-3xl text-center text-[clamp(1.9rem,5vw,3.2rem)] font-semibold leading-[1.08] text-[var(--landing-fg)]">
          Tudo que você precisa em um único plano.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-center text-[15px] leading-6 text-[var(--landing-muted)]">
          Uma plataforma onde você lê, aprende e conversa sobre as ideias que realmente importam.
        </p>

        <div className="mx-auto mt-14 grid w-full max-w-[880px] gap-6 md:grid-cols-2">
          {Object.values(PLANS).map((plan) => {
            const annual = plan.id === "annual";
            return (
              <article key={plan.id} className={`relative flex flex-col rounded-[8px] border bg-[var(--landing-surface)] ${annual ? "border-[var(--landing-brand)]" : "border-[var(--landing-border)]"}`}>
                {annual && (
                  <span className="absolute -top-3 left-7 rounded-full bg-[var(--landing-brand)] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-white">
                    {plan.discountText}
                  </span>
                )}
                <div className="border-b border-[var(--landing-border)] p-7">
                  <h3 className="text-xl font-semibold text-[var(--landing-fg)]">{plan.label}</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--landing-muted)]">{plan.description}</p>
                  <p className="mt-7 flex items-baseline gap-1">
                    <span className="text-lg font-medium text-[var(--landing-fg)]">R$</span>
                    <span className="text-5xl font-semibold text-[var(--landing-fg)]">{plan.price / 100}</span>
                    <span className="text-sm text-[var(--landing-muted)]">{plan.period}</span>
                  </p>
                  <p className="mt-2 text-xs text-[var(--landing-muted)]">
                    {annual ? `Apenas R$ ${plan.monthlyEquivalent}/mês` : "Cancele quando quiser"}
                  </p>
                </div>
                <ul className="space-y-3 p-7">
                  {plan.benefits.map((benefit) => (
                    <PlanBenefitItem
                      key={benefit.text}
                      benefit={benefit}
                      iconClassName="size-4 shrink-0 text-[var(--landing-brand)]"
                      className="flex items-center gap-3 text-sm text-[var(--landing-fg)]"
                      showCheck
                    />
                  ))}
                </ul>
                <div className="mt-auto border-t border-[var(--landing-border)] p-5">
                  <Link to={destination} className="flex min-h-12 w-full items-center justify-center rounded-full bg-[linear-gradient(110deg,var(--landing-brand-strong),var(--landing-brand))] px-6 text-sm font-medium text-white">
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
    <section className="bg-[var(--landing-bg)] py-20 md:py-28">
      <div className="mx-auto w-full max-w-[760px] px-6">
        <p className="text-center font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--landing-muted)]">FAQ</p>
        <h2 className="mt-4 text-center text-[clamp(1.9rem,5vw,3rem)] font-semibold text-[var(--landing-fg)]">Perguntas frequentes</h2>
        <div className="mt-12 space-y-3">
          {faqs.map((faq) => (
            <details key={faq.q} className="group rounded-[8px] border border-[var(--landing-border)] bg-[var(--landing-surface)] px-5">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 text-sm text-[var(--landing-fg)]">
                {faq.q}
                <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" />
              </summary>
              <p className="pb-5 text-sm leading-6 text-[var(--landing-muted)]">{faq.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LandingSupport() {
  return (
    <footer id="suporte" className="bg-[var(--landing-section)] py-24 md:py-28">
      <div className="mx-auto w-full max-w-[760px] px-6 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--landing-muted)]">Suporte</p>
        <h2 className="mt-4 text-[clamp(1.9rem,5vw,3rem)] font-semibold text-[var(--landing-fg)]">Ainda tem dúvidas?</h2>
        <p className="mx-auto mt-4 max-w-md text-[15px] leading-6 text-[var(--landing-muted)]">
          Fale diretamente com o criador do clube antes de assinar.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <a href="#planos" className="group inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--landing-brand)] px-6 text-sm font-medium text-white">
            Assinar o clube
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </a>
          <a
            href={WHATSAPP_SUPPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Tirar dúvidas pelo WhatsApp"
            className="inline-flex min-h-12 items-center gap-3 rounded-full border border-[#25D366]/50 bg-[#25D366]/10 py-2 pl-2 pr-6 text-sm font-medium text-[var(--landing-fg)] transition-colors hover:bg-[#25D366]/20"
          >
            <WhatsAppBadge />
            Tirar minhas dúvidas
          </a>
        </div>
        <p className="mt-16 text-xs text-[var(--landing-muted)]">© {new Date().getFullYear()} OPE Club</p>
      </div>
    </footer>
  );
}
