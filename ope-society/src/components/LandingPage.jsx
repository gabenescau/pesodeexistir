import { Header } from '@/components/header'
import { HeroSection } from '@/components/hero'
import { BooksSection } from '@/components/books-section'
import { NotALibrary } from '@/components/not-a-library'
import { FeatureSection } from '@/components/feature-section'
import { AuthorsSection } from '@/components/authors-section'
import { MoreThanReading } from '@/components/more-than-reading'
import { TestimonialsSection } from '@/components/testimonials-section'
import { AlwaysEvolving } from '@/components/always-evolving'
import { HowItWorks } from '@/components/how-it-works'
import { PricingSection } from '@/components/pricing-section'
import { FAQ } from '@/components/faq'

export function LandingPage() {
  return (
    <div className="sales-page relative min-h-screen bg-background text-foreground">
      <Header />
      <main className="overflow-x-hidden">
        <HeroSection />
        <BooksSection />
        <NotALibrary />
        <FeatureSection />
        <AuthorsSection />
        <MoreThanReading />
        <TestimonialsSection />
        <AlwaysEvolving />
        <HowItWorks />
        <PricingSection />
        <FAQ />
      </main>
    </div>
  )
}
