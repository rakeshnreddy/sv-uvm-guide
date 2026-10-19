import type { Metadata } from 'next';

import { PLACEMENT_ASSESSMENT_VERSION, PLACEMENT_SCORING_VERSION } from '@/components/assessment/placementQuizData';
import { curriculumData } from '@/lib/curriculum-data';
import { getAllLabs } from '@/lib/lab-registry';
import { buildCurriculumTotals, type ExerciseMeta, type LabMeta } from '@/lib/learner-stats';
import { resolveRoutes } from '@/lib/learning-paths';
import { getPracticePage } from '@/lib/practice-links';

import DashboardPageClient, { type DashboardRoute } from './DashboardPageClient';

export const metadata: Metadata = {
  title: 'Your learning',
  description:
    'Lessons, labs, flashcard reviews, notes and quiz results recorded in this browser, with what to do next.',
};

// A static shell: everything learner-specific is read in the browser after hydration.
export const dynamic = 'error';

/** The exercises that save a best score (useExerciseProgress ids) and their pages. */
const EXERCISE_PAGES: readonly { id: string; href: string }[] = [
  { id: 'uvm-phase-sorter', href: '/exercises/uvm-phase-sorter' },
  { id: 'uvm-agent-builder', href: '/exercises/uvm-agent-builder' },
  { id: 'scoreboard-connector', href: '/exercises/scoreboard-connector' },
  { id: 'sequencer-arbitration-sandbox', href: '/exercises/sequencer-arbitration' },
];

export default function DashboardPage() {
  const labs = getAllLabs();
  // The same route sequences the curriculum overview uses, trimmed to what "Continue" needs.
  const routes: DashboardRoute[] = resolveRoutes(curriculumData, { labs }).map((route) => ({
    id: route.id,
    name: route.name,
    sequence: route.sequence,
  }));
  const availableLabs: LabMeta[] = labs
    .filter((lab) => lab.status === 'available')
    .map((lab) => ({
      id: lab.id,
      version: lab.version,
      title: lab.title.replace(/\s+/g, ' ').trim(),
      stepCount: lab.steps.length,
      href: `/practice/lab/${lab.id}`,
    }));
  const exercises: ExerciseMeta[] = EXERCISE_PAGES.flatMap(({ id, href }) => {
    const page = getPracticePage(href);
    return page?.href ? [{ id, title: page.title, href: page.href }] : [];
  });

  return (
    <DashboardPageClient
      curriculum={buildCurriculumTotals(curriculumData)}
      routes={routes}
      labs={availableLabs}
      exercises={exercises}
      placementVersions={{ assessmentVersion: PLACEMENT_ASSESSMENT_VERSION, scoringVersion: PLACEMENT_SCORING_VERSION }}
    />
  );
}
