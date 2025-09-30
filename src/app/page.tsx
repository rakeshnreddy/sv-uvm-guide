"use client";

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import HeroSection from '@/components/home/HeroSection';
import PersonalizationSection from '@/components/home/PersonalizationSection';
import { useAuth } from '@/contexts/AuthContext';
import {
  derivePersonalization,
  DEFAULT_ENGAGEMENT_SNAPSHOT,
  type EngagementSnapshot,
  type PersonalizedHomeUser,
} from '@/lib/personalization';

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
  const { user: authUser, loading: authLoading } = useAuth();
  const [personalization, setPersonalization] = useState<PersonalizedHomeUser | null>(null);
  const [isLoadingPersonalization, setIsLoadingPersonalization] = useState(false);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!authUser) {
      setPersonalization(null);
      setIsLoadingPersonalization(false);
      return;
    }

    let isMounted = true;
    const abortController = new AbortController();

    const loadPersonalization = async () => {
      setIsLoadingPersonalization(true);
      try {
        const response = await fetch(`/api/engagement/${authUser.uid}`, {
          signal: abortController.signal,
        });

        let snapshot: EngagementSnapshot | null = null;

        if (response.ok) {
          const payload = await response.json();
          snapshot = {
            metrics: payload.metrics ?? DEFAULT_ENGAGEMENT_SNAPSHOT.metrics,
            activityHistory: payload.activityHistory ?? DEFAULT_ENGAGEMENT_SNAPSHOT.activityHistory,
          } satisfies EngagementSnapshot;
        }

        if (isMounted) {
          setPersonalization(
            derivePersonalization(snapshot ?? DEFAULT_ENGAGEMENT_SNAPSHOT, {
              displayName: authUser.displayName,
            }),
          );
        }
      } catch (error) {
        if (!isMounted || (error as Error).name === 'AbortError') {
          return;
        }
        setPersonalization(
          derivePersonalization(DEFAULT_ENGAGEMENT_SNAPSHOT, {
            displayName: authUser.displayName,
          }),
        );
      } finally {
        if (isMounted) {
          setIsLoadingPersonalization(false);
        }
      }
    };

    loadPersonalization();

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, [authUser, authLoading]);

  return (
    <main className="flex flex-col items-center w-full bg-background">
      <HeroSection />

      {/* The PersonalizationSection will only render if personalization data is available */}
      <PersonalizationSection
        user={personalization}
        isLoading={isLoadingPersonalization}
      />

      <LearningPathsSection />
      <InteractiveFeaturesSection />
    </main>
  );
}
