'use client';

import React, { useMemo, useSyncExternalStore } from 'react';

import { useCurriculumProgress } from '@/hooks/useCurriculumProgress';
import { indexOverviewLessons, type OverviewTier, type PlannedModule } from '@/lib/curriculum-overview';
import type { ResolvedMilestone, ResolvedRoute } from '@/lib/learning-paths';
import {
  lastVisit,
  readSelectedRoute,
  subscribeSelectedRoute,
  writeSelectedRoute,
  type ProgressLike,
} from '@/lib/learning-route-state';
import { CurriculumBrowser } from './CurriculumBrowser';
import { Recommendations } from './Recommendations';
import { RouteChooser } from './RouteChooser';

export interface CurriculumOverviewProps {
  tiers: OverviewTier[];
  routes: ResolvedRoute[];
  milestones: ResolvedMilestone[];
  planned: readonly PlannedModule[];
}

const NO_PROGRESS: ProgressLike = {};
const serverRoute = () => null;

/**
 * The interactive part of /curriculum. The server page builds every piece of
 * data from the manifest; this component adds what only the browser knows:
 * the route the learner follows and the lessons they opened.
 */
export default function CurriculumOverview({ tiers, routes, milestones, planned }: CurriculumOverviewProps) {
  const { progress, isLoaded } = useCurriculumProgress();
  const selectedRoute = useSyncExternalStore(subscribeSelectedRoute, readSelectedRoute, serverRoute);

  const visits: ProgressLike = isLoaded ? progress : NO_PROGRESS;
  const lessons = useMemo(() => indexOverviewLessons(tiers), [tiers]);
  const milestoneNames = useMemo(() => Object.fromEntries(milestones.map((m) => [m.id, m.name])), [milestones]);
  const visitedModules = useMemo(
    () => new Set(Object.entries(visits).filter(([, entry]) => entry?.lastVisitedAt).map(([id]) => id)),
    [visits],
  );
  const here = lastVisit(visits);
  const hereModuleId = here && lessons.has(`${here.moduleId}/${here.lessonSlug}`) ? here.moduleId : undefined;

  return (
    <>
      <Recommendations
        routes={routes}
        selectedRoute={selectedRoute}
        progress={visits}
        lessons={lessons}
        ready={isLoaded}
      />
      <RouteChooser
        routes={routes}
        milestones={milestones}
        selectedRoute={selectedRoute}
        onSelectRoute={writeSelectedRoute}
        progress={visits}
      />
      <CurriculumBrowser
        tiers={tiers}
        planned={planned}
        milestoneNames={milestoneNames}
        visitedModules={visitedModules}
        hereModuleId={hereModuleId}
      />
    </>
  );
}
