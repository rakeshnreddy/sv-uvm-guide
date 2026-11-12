import type { Metadata } from 'next';
import React from 'react';

import { loadInterviewBanks } from '@/app/(learning)/interview-prep/interview-banks';
import { placementQuestions } from '@/components/assessment/placementQuizData';
import Footer from '@/components/Footer';
import ClosingRow from '@/components/home/ClosingRow';
import HeroSection from '@/components/home/HeroSection';
import { getLandingFacts, landingDescription } from '@/components/home/home-stats';
import HowYouLearnSection, { type StepLesson } from '@/components/home/HowYouLearnSection';
import { returningLearnerScript } from '@/components/home/landing-resume';
import { buildPathTiers } from '@/components/home/path-tiers';
import ProofStrip from '@/components/home/ProofStrip';
import ReturningLearnerStrip from '@/components/home/ReturningLearnerStrip';
import RoutesStrip from '@/components/home/RoutesStrip';
import { LIVE_MODEL_HREF, buildSchedulerFrame, liveModelLink } from '@/components/home/scheduler-frame';
import { buildStepPreviews, interviewLevelCount } from '@/components/home/step-previews';
import { PageShell } from '@/components/layout/PageShell';
import { continueLessons } from '@/lib/continue-lesson-data';
import { curriculumData } from '@/lib/curriculum-data';
import { readLessonBody, readManifestTiers } from '@/lib/curriculum-scan';
import { getAllLabs } from '@/lib/lab-registry';
import { buildCurriculumTotals } from '@/lib/learner-stats';
import { resolveRoutes, summarizeRoutes } from '@/lib/learning-paths';
import { getPracticeLabItems, getPracticePages } from '@/lib/practice-links';
import { TIER_LINKS } from '@/lib/site-links';

/**
 * Every count on the page, from the data the rest of the site uses. Read at
 * build time: the page is static (no cookies(), headers() or other dynamic
 * functions) and is served from the prerendered cache.
 */
function landingData() {
  const labs = getAllLabs();
  const interviewBanks = loadInterviewBanks();
  const lessons = continueLessons();
  const firstLesson = lessonAt(lessons, lessons[0]?.href ?? '');
  const modelLesson = { ...lessonAt(lessons, LIVE_MODEL_HREF.split('#')[0]), href: liveModelLink() };
  return {
    facts: getLandingFacts({
      curriculum: curriculumData,
      labs,
      practicePages: getPracticePages(),
      interviewBanks,
      placementQuestions,
    }),
    // "The path": the tiers as the curriculum page shows them (the navigation config, the totals and the manifest).
    tiers: buildPathTiers({ totals: buildCurriculumTotals(curriculumData), manifestTiers: readManifestTiers(), tierLinks: TIER_LINKS }),
    // The learner routes from src/lib/learning-paths.ts, resolved here so the strip receives plain data.
    routes: summarizeRoutes(resolveRoutes(curriculumData, { labs })),
    // Plain data for the client islands (the primary actions, the path's tag and the returning-learner strip):
    // the same lesson list the header, the curriculum page and the dashboard resolve "Continue" against.
    lessons,
    firstLesson,
    modelLesson,
    interviewLevelCount: interviewLevelCount(interviewBanks),
    // The small previews on the "How you learn here" cards, from lesson 1, the scheduler model, the labs and the banks.
    previews: buildStepPreviews({
      firstLesson: { code: firstLesson.code, body: lessonBody(firstLesson.href) },
      modelCode: modelLesson.code,
      frame: buildSchedulerFrame(),
      labItems: getPracticeLabItems(labs),
      labs,
      interviewBanks,
    }),
  };
}

/** A lesson from the lesson list by its path. */
function lessonAt(lessons: ReturnType<typeof continueLessons>, href: string): StepLesson {
  const lesson = lessons.find((entry) => entry.href === href);
  if (!lesson) throw new Error(`The lesson ${href} is not in the lesson list`);
  return { code: lesson.code, title: lesson.title, href: lesson.href };
}

/** "/curriculum/<tier>/<module>/<lesson>" -> that lesson's MDX body. */
function lessonBody(href: string): string | null {
  const [tierId, moduleId, lessonSlug] = href.replace(/^\/curriculum\//, '').split('/');
  return tierId && moduleId && lessonSlug ? readLessonBody(tierId, moduleId, lessonSlug) : null;
}

export function generateMetadata(): Metadata {
  return { description: landingDescription(landingData().facts) };
}

export default function HomePage() {
  const { facts, tiers, routes, lessons, firstLesson, modelLesson, interviewLevelCount: levels, previews } = landingData();

  return (
    // No background of its own: the body's page colour shows, and the public layout's colour field shows behind the hero.
    <div className="flex min-h-screen flex-col text-foreground">
      <main id="main-content" tabIndex={-1} className="w-full flex-1 focus:outline-none">
        {/* Marks <html> before first paint when this browser holds a lesson visit, so reserved spaces are right. */}
        <script dangerouslySetInnerHTML={{ __html: returningLearnerScript() }} />
        <PageShell width="content" className="pb-20 pt-0 sm:pb-24">
          <HeroSection facts={facts} lessons={lessons} tiers={tiers} />
          <ProofStrip facts={facts} />
          <ReturningLearnerStrip lessons={lessons} />
          <div className="mt-16 lg:mt-20">
            <HowYouLearnSection facts={facts} previews={previews} firstLesson={firstLesson} modelLesson={modelLesson} interviewLevelCount={levels} />
          </div>
          <div className="mt-16 lg:mt-20">
            <RoutesStrip routes={routes} />
          </div>
          <div className="mt-16 lg:mt-20">
            <ClosingRow lessons={lessons} lessonCount={facts.lessonCount} />
          </div>
        </PageShell>
      </main>
      <Footer />
    </div>
  );
}
