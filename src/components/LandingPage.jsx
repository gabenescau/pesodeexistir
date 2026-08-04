import { LandingAbout, LandingFeatures } from "./landing-v2/LandingContent";
import { LandingEcosystem, LandingGamificationShop } from "./landing-v2/LandingEcosystem";
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
        title="OPE Club | O Maior Ecossistema de Filosofia e Literatura"
        description="Leitor digital integrado sem PDFs, rede social exclusiva de reflexões, sistema de gamificação com XP e Loja Oficial com frete grátis para resgatar livros, camisetas e moletons."
        canonical="https://pesodeexistir.online/"
        type="website"
        image="https://pesodeexistir.online/hero/backgroundnovo.png"
        jsonLd={[
          buildOrganizationJsonLd(),
          buildProductJsonLd({
            name: "OPE Club - Plano Leitor",
            description: "Acesso completo ao ecossistema: leitor digital no app, comunidade social e resgate de produtos físicos por R$ 19/mês.",
            priceCents: 1900,
            url: "https://pesodeexistir.online/assinar",
          }),
        ]}
      />
      <LandingHeader />
      <main>
        <LandingHero />
        <LandingLibrary />
        <LandingEcosystem />
        <LandingGamificationShop />
        <LandingAuthors />
        <LandingAbout />
        <LandingFeatures />
        <LandingTestimonials />
        <LandingPricing />
        <LandingFaq />
      </main>
      <LandingSupport />
    </div>
  );
}
