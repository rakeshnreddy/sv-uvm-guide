import type { Metadata } from 'next';
import React from 'react';

import { loadInterviewBanks } from '@/app/(learning)/interview-prep/interview-banks';
import { placementQuestions } from '@/components/assessment/placementQuizData';
import Footer from '@/components/Footer';
import HeroSection from '@/components/home/HeroSection';
import { getLandingFacts, landingDescription } from '@/components/home/home-stats';
import InteractiveFeaturesSection from '@/components/home/InteractiveFeaturesSection';
import { returningLearnerScript } from '@/components/home/landing-resume';
import ProofStrip from '@/components/home/ProofStrip';
import ReturningLearnerStrip from '@/components/home/ReturningLearnerStrip';
import RoutesStrip from '@/components/home/RoutesStrip';
import { buildSchedulerFrame } from '@/components/home/scheduler-frame';
import { PageShell } from '@/components/layout/PageShell';
import { continueLessons } from '@/lib/continue-lesson-data';
import { curriculumData } from '@/lib/curriculum-data';
import { getAllLabs } from '@/lib/lab-registry';
import { resolveRoutes, summarizeRoutes } from '@/lib/learning-paths';
import { getPracticePages } from '@/lib/practice-links';

/**
 * Every count on the page, from the data the rest of the site uses. Read at
 * build time: the page is static (no cookies(), headers() or other dynamic
 * functions) and is served from the prerendered cache.
 */
function landingData() {
  const labs = getAllLabs();
  return {
    facts: getLandingFacts({
      curriculum: curriculumData,
      labs,
      practicePages: getPracticePages(),
      interviewBanks: loadInterviewBanks(),
      placementQuestions,
    }),
    // The learner routes from src/lib/learning-paths.ts, resolved here so the strip receives plain data.
    routes: summarizeRoutes(resolveRoutes(curriculumData, { labs })),
    // Plain data for the two client islands (the primary action and the returning-learner strip):
    // the same lesson list the header, the curriculum page and the dashboard resolve "Continue" against.
    lessons: continueLessons(),
    frame: buildSchedulerFrame(),
  };
}

export function generateMetadata(): Metadata {
  return { description: landingDescription(landingData().facts) };
}

export default function HomePage() {
  const { facts, routes, lessons, frame } = landingData();

  return (
    // No background of its own: the body's page colour shows, and the public layout's colour field shows behind the hero.
    <div className="flex min-h-screen flex-col text-foreground">
      <main id="main-content" tabIndex={-1} className="w-full flex-1 focus:outline-none">
        {/* Marks <html> before first paint when this browser holds a lesson visit, so the strip's space is reserved. */}
        <script dangerouslySetInnerHTML={{ __html: returningLearnerScript() }} />
        <PageShell width="content" className="pb-20 pt-0 sm:pb-24">
          <HeroSection stats={facts} lessons={lessons} placementQuestionCount={facts.placementQuestionCount} frame={frame} />
          <ProofStrip facts={facts} />
          <ReturningLearnerStrip lessons={lessons} />
          <div className="mt-16 lg:mt-20">
            <RoutesStrip routes={routes} />
          </div>
          <div className="mt-16 lg:mt-20">
            <InteractiveFeaturesSection facts={facts} />
          </div>
        </PageShell>
      </main>
      <Footer />
    </div>
  );
}
