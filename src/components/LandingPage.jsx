import { LandingAbout, LandingFeatures, LandingSteps } from "./landing-v2/LandingContent";
import { LandingHeader, LandingHero } from "./landing-v2/LandingHeaderHero";
import { LandingAuthors, LandingLibrary } from "./landing-v2/LandingLibraryAuthors";
import {
  LandingFaq,
  LandingPricing,
  LandingSupport,
  LandingTestimonials,
} from "./landing-v2/LandingSocialPricing";
import { Seo, buildOrganizationJsonLd, buildProductJsonLd } from "./seo";

export function LandingPage() {
  return (
    <div className="ope-landing min-h-screen overflow-x-hidden bg-[var(--landing-bg)] text-[var(--landing-fg)]">
      <Seo
        title="OPE Club | Biblioteca e Comunidade de Filosofia e Literatura"
        description="Le mais, pensa mais, conversa mais. OPE Club e uma biblioteca curada de filosofia e literatura com comunidade integrada, lancamentos semanais e leitura offline."
        canonical="https://pesodeexistir.online/"
        type="website"
        image="https://pesodeexistir.online/hero/backgroundnovo.png"
        jsonLd={[
          buildOrganizationJsonLd(),
          buildProductJsonLd({
            name: "OPE Club - Assinatura Anual",
            description: "Acesso completo a biblioteca de filosofia e literatura, comunidade integrada e lancamentos semanais por R$ 14/mes.",
            priceCents: 16800,
            url: "https://pesodeexistir.online/assinar",
          }),
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: [
              {
                "@type": "Question",
                name: "Por que cobrar mensalmente?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "A mensalidade sustenta a curadoria continua do acervo, a moderacao da comunidade e a manutencao do aplicativo.",
                },
              },
              {
                "@type": "Question",
                name: "E so uma biblioteca?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Nao. A biblioteca e metade do OPE Club. A outra metade e a comunidade: publicacoes, discussoes, comentarios e recomendacoes entre leitores.",
                },
              },
            ],
          },
        ]}
      />
      <LandingHeader />
      <main>
        <LandingHero />
        <LandingLibrary />
        <LandingAbout />
        <LandingFeatures />
        <LandingAuthors />
        <LandingTestimonials />
        <LandingSteps />
        <LandingPricing />
        <LandingFaq />
      </main>
      <LandingSupport />
    </div>
  );
}
