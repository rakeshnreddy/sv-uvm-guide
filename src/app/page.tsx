"use client";

import React from 'react';
import dynamic from 'next/dynamic';
import HeroSection from '@/components/home/HeroSection';
import PersonalizationSection from '@/components/home/PersonalizationSection';

// Mock user data for demonstration purposes
const mockUser = {
  name: 'Jules',
  lastLesson: {
    title: 'UVM Phasing In-Depth',
    href: '/curriculum/T2_Intermediate/I-UVM-5_Phasing_and_Synchronization',
  },
  progress: 75,
  streak: 12,
};

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
const CommunitySection = dynamic(() => import('@/components/home/CommunitySection'), {
  loading: () => <LoadingPlaceholder />,
});

export default function HomePage() {
  // In a real application, this user object would come from a session provider or an auth hook.
  // For this redesign demonstration, we'll use the mock user to show the personalization feature.
  // To see the page as a logged-out user, you would set `mockUser` to `null`.
  return (
    <main className="flex flex-col items-center w-full bg-background">
      <HeroSection />

      {/* The PersonalizationSection will only render if a user object is present */}
      <PersonalizationSection user={mockUser} />

      <LearningPathsSection />
      <InteractiveFeaturesSection />
      <CommunitySection />
    </main>
  );
}
