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
import { buildPractiseThumbnails } from '@/components/home/practise-thumbnails';
import { HERO_SCENARIO_ID, LIVE_MODEL_HREF, buildSchedulerFrame, buildSchedulerFrameAt } from '@/components/home/scheduler-frame';
import SeeItRunSection, { type SeeItRunLesson } from '@/components/home/SeeItRunSection';
import { PageShell } from '@/components/layout/PageShell';
import { continueLessons } from '@/lib/continue-lesson-data';
import { curriculumData } from '@/lib/curriculum-data';
import { getAllLabs } from '@/lib/lab-registry';
import { resolveRoutes, summarizeRoutes } from '@/lib/learning-paths';
import { getPracticeLabItems, getPracticePages, requirePracticePage } from '@/lib/practice-links';

/**
 * Every count on the page, from the data the rest of the site uses. Read at
 * build time: the page is static (no cookies(), headers() or other dynamic
 * functions) and is served from the prerendered cache.
 */
function landingData() {
  const labs = getAllLabs();
  const interviewBanks = loadInterviewBanks();
  const lessons = continueLessons();
  const frame = buildSchedulerFrame();
  const liveLesson = liveModelLesson(lessons);
  return {
    facts: getLandingFacts({
      curriculum: curriculumData,
      labs,
      practicePages: getPracticePages(),
      interviewBanks,
      placementQuestions,
    }),
    // The learner routes from src/lib/learning-paths.ts, resolved here so the strip receives plain data.
    routes: summarizeRoutes(resolveRoutes(curriculumData, { labs })),
    // Plain data for the two client islands (the primary action and the returning-learner strip):
    // the same lesson list the header, the curriculum page and the dashboard resolve "Continue" against.
    lessons,
    frame,
    // "See it run": the same scenario as the hero's frame, from the step the live visualizer opens on.
    liveFrame: buildSchedulerFrameAt(HERO_SCENARIO_ID, 0),
    liveLesson,
    // Small drawings for the practise cards, from the labs, the phase model, the scheduler run and the interview banks.
    thumbnails: buildPractiseThumbnails({
      labItems: getPracticeLabItems(labs),
      labs,
      interviewBanks,
      frame,
      sorterCode: requirePracticePage(PHASE_SORTER_HREF).lessons[0]?.code ?? '',
      modelCode: liveLesson.code,
    }),
  };
}

/** The exercise the "Exercises" card draws: the phase sorter's lanes. */
const PHASE_SORTER_HREF = '/exercises/uvm-phase-sorter';

/** The lesson that holds the live model (LIVE_MODEL_HREF), from the lesson list; the link keeps the heading anchor. */
function liveModelLesson(lessons: ReturnType<typeof continueLessons>): SeeItRunLesson {
  const [path] = LIVE_MODEL_HREF.split('#');
  const lesson = lessons.find((entry) => entry.href === path);
  if (!lesson) throw new Error(`The live model's lesson ${path} is not in the lesson list`);
  return { code: lesson.code, title: lesson.title, href: LIVE_MODEL_HREF };
}

export function generateMetadata(): Metadata {
  return { description: landingDescription(landingData().facts) };
}

export default function HomePage() {
  const { facts, routes, lessons, frame, liveFrame, liveLesson, thumbnails } = landingData();

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
            <SeeItRunSection scenario={HERO_SCENARIO_ID} frame={liveFrame} lesson={liveLesson} />
          </div>
          <div className="mt-16 lg:mt-20">
            <RoutesStrip routes={routes} />
          </div>
          <div className="mt-16 lg:mt-20">
            <InteractiveFeaturesSection facts={facts} thumbnails={thumbnails} />
          </div>
        </PageShell>
      </main>
      <Footer />
    </div>
  );
}
