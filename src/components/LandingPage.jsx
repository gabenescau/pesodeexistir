import { LandingAbout, LandingFeatures, LandingSteps } from "./landing-v2/LandingContent";
import { LandingHeader, LandingHero } from "./landing-v2/LandingHeaderHero";
import { LandingAuthors, LandingLibrary } from "./landing-v2/LandingLibraryAuthors";
import {
  LandingFaq,
  LandingPricing,
  LandingSupport,
  LandingTestimonials,
} from "./landing-v2/LandingSocialPricing";

export function LandingPage() {
  return (
    <div className="ope-landing min-h-screen overflow-x-hidden bg-[var(--landing-bg)] text-[var(--landing-fg)]">
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
