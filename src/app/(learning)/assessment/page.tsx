import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import {
  PLACEMENT_ASSESSMENT_VERSION,
  PLACEMENT_SCORING_VERSION,
  placementCategoryFocus,
  placementTierRecommendations,
} from '@/components/assessment/placementQuizData';
import { curriculumData } from '@/lib/curriculum-data';
import { getAllLabs } from '@/lib/lab-registry';
import { buildCurriculumTotals } from '@/lib/learner-stats';
import { resolvePlacementPlan, resolveRoutes } from '@/lib/learning-paths';
import { SITE_FEATURES } from '@/lib/site-features';

import AssessmentPageClient from './AssessmentPageClient';
import type { AssessmentLab, AssessmentPlacementPlan, PlacementAreaId } from './assessment-model';

export const metadata: Metadata = {
  title: 'Self-assessment',
  description:
    'Lessons done, quiz results, labs, flashcard reviews and your placement result per track, read from this browser, with the lessons and labs to do next.',
};

// A static shell: everything learner-specific is read in the browser after hydration.
export const dynamic = 'error';

/**
 * The self-assessment page. It is built only from what the learner recorded
 * in this browser (src/lib/learner-store): no sample scores and no
 * certificates. SITE_FEATURES.assessmentCenter is on in every build; the
 * page is a learner page, so it stays out of the sitemap and robots.txt
 * disallows it, as for /dashboard.
 */
export default function AssessmentPage() {
  if (!SITE_FEATURES.assessmentCenter) {
    notFound();
  }

  const allLabs = getAllLabs();
  const labs: AssessmentLab[] = allLabs
    .filter((lab) => lab.status === 'available')
    .map((lab) => ({
      id: lab.id,
      version: lab.version,
      title: lab.title.replace(/\s+/g, ' ').trim(),
      href: `/practice/lab/${lab.id}`,
      stepCount: lab.steps.length,
      owningModule: lab.owningModule,
      labPrerequisites: [...lab.labPrerequisites],
    }));

  const routes = resolveRoutes(curriculumData, { labs: allLabs });
  const placementPlans: AssessmentPlacementPlan[] = placementTierRecommendations.map((recommendation) => {
    const plan = resolvePlacementPlan(recommendation.route, routes);
    return {
      tier: plan.tier,
      routeId: plan.routeId,
      routeName: plan.routeName,
      startHref: plan.startHref,
      startTitle: plan.startTitle,
      startModuleCode: plan.startModuleCode,
    };
  });

  const placementAreaTitles = Object.fromEntries(
    (Object.keys(placementCategoryFocus) as PlacementAreaId[]).map((area) => [area, placementCategoryFocus[area].title]),
  ) as Record<PlacementAreaId, string>;

  return (
    <AssessmentPageClient
      curriculum={buildCurriculumTotals(curriculumData)}
      labs={labs}
      placementPlans={placementPlans}
      placementAreaTitles={placementAreaTitles}
      placementVersions={{ assessmentVersion: PLACEMENT_ASSESSMENT_VERSION, scoringVersion: PLACEMENT_SCORING_VERSION }}
    />
  );
}
