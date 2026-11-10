import React from 'react';
import Footer from '@/components/Footer';
import HeroSection from '@/components/home/HeroSection';
import { getHomeStats } from '@/components/home/home-stats';
import InteractiveFeaturesSection from '@/components/home/InteractiveFeaturesSection';
import LearningPathsSection from '@/components/home/LearningPathsSection';
import { curriculumData } from '@/lib/curriculum-data';
import { getAllLabs } from '@/lib/lab-registry';
import { resolveRoutes, summarizeRoutes } from '@/lib/learning-paths';

export default function HomePage() {
  // The learner routes from src/lib/learning-paths.ts, resolved here so the cards receive plain data
  // and never bundle the curriculum (G30-PATH-05; NB2 request 3).
  const labs = getAllLabs();
  const routes = summarizeRoutes(resolveRoutes(curriculumData, { labs }));
  // The hero states counts from the data, not hand-written numbers.
  const stats = getHomeStats(curriculumData, labs);

  // The site footer, as on the privacy and terms pages: its site map links a first-time visitor to the
  // Privacy Policy and Terms, which explain what this site keeps in the browser.
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <main className="flex flex-col items-center w-full flex-1 bg-background">
        <HeroSection {...stats} />

        <LearningPathsSection routes={routes} />
        <InteractiveFeaturesSection />
      </main>
      <Footer />
    </div>
  );
}
