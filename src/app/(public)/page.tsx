import React from 'react';
import dynamic from 'next/dynamic';
import HeroSection from '@/components/home/HeroSection';
import { curriculumData } from '@/lib/curriculum-data';
import { getAllLabs } from '@/lib/lab-registry';
import { resolveRoutes, summarizeRoutes } from '@/lib/learning-paths';

// A simple placeholder for lazy-loaded components
const LoadingPlaceholder = () => (
  <div className="h-96 w-full flex items-center justify-center bg-background">
    <p className="text-lg text-muted-foreground animate-pulse">Loading Section...</p>
  </div>
);

// Lazy load components that are below the fold for better performance
const LearningPathsSection = dynamic(() => import('@/components/home/LearningPathsSection'), {
  loading: () => <LoadingPlaceholder />,
});
const InteractiveFeaturesSection = dynamic(() => import('@/components/home/InteractiveFeaturesSection'), {
  loading: () => <LoadingPlaceholder />,
});
export default function HomePage() {
  // The learner routes from src/lib/learning-paths.ts, resolved here so the cards receive plain data
  // and never bundle the curriculum (G30-PATH-05; NB2 request 3).
  const routes = summarizeRoutes(resolveRoutes(curriculumData, { labs: getAllLabs() }));

  return (
    <main className="flex flex-col items-center w-full bg-background">
      <HeroSection />

      <LearningPathsSection routes={routes} />
      <InteractiveFeaturesSection />
    </main>
  );
}
