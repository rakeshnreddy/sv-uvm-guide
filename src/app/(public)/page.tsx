import React from 'react';
import dynamic from 'next/dynamic';
import HeroSection from '@/components/home/HeroSection';

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
  return (
    <main className="flex flex-col items-center w-full bg-background">
      <HeroSection />

      <LearningPathsSection />
      <InteractiveFeaturesSection />
    </main>
  );
}
