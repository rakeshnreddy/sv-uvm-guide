'use client';

import React, { useMemo, useSyncExternalStore } from 'react';

import { useContinueLesson } from '@/hooks/useContinueLesson';
import { useCurriculumProgress } from '@/hooks/useCurriculumProgress';
import type { ContinueLessonEntry } from '@/lib/continue-lesson';
import { indexOverviewLessons, type OverviewTier, type PlannedModule } from '@/lib/curriculum-overview';
import { useRecord } from '@/lib/learner-store/react';
import { lessonLogRecord } from '@/lib/learner-store/repositories/lessons';
import type { ResolvedMilestone, ResolvedRoute } from '@/lib/learning-paths';
import {
  lastVisit,
  readSelectedRoute,
  subscribeSelectedRoute,
  writeSelectedRoute,
  type ProgressLike,
} from '@/lib/learning-route-state';
import { emptyTraces, progressTraces } from '@/lib/progress-trace';
import { CurriculumBrowser } from './CurriculumBrowser';
import { Recommendations } from './Recommendations';
import { RouteChooser } from './RouteChooser';
import { cursorModule, moduleStates, staticTierOf } from './tier-trace';

export interface CurriculumOverviewProps {
  tiers: OverviewTier[];
  routes: ResolvedRoute[];
  milestones: ResolvedMilestone[];
  planned: readonly PlannedModule[];
  /** Every lesson in course order (continueLessons()), for the one continue rule. */
  continueLessons: readonly ContinueLessonEntry[];
}

const NO_PROGRESS: ProgressLike = {};
const serverRoute = () => null;

/**
 * The interactive part of /curriculum. The server page builds every piece of
 * data from the manifest; this component adds what only the browser knows:
 * the route the learner follows, the lessons they opened and marked done, and
 * the lesson to continue. One set of progress traces (src/lib/progress-trace.ts)
 * feeds the tier headings' miniature traces and the module cards' states, so
 * the two always agree.
 */
export default function CurriculumOverview({ tiers, routes, milestones, planned, continueLessons }: CurriculumOverviewProps) {
  const { progress, isLoaded } = useCurriculumProgress();
  const lessonLog = useRecord(lessonLogRecord);
  const position = useContinueLesson(continueLessons);
  const selectedRoute = useSyncExternalStore(subscribeSelectedRoute, readSelectedRoute, serverRoute);

  const visits: ProgressLike = isLoaded ? progress : NO_PROGRESS;
  const lessons = useMemo(() => indexOverviewLessons(tiers), [tiers]);
  const milestoneNames = useMemo(() => Object.fromEntries(milestones.map((m) => [m.id, m.name])), [milestones]);
  const staticTiers = useMemo(() => tiers.map(staticTierOf), [tiers]);
  // The server render and the hydrating render draw every module not started, so nothing moves when progress arrives.
  const traces = useMemo(
    () => (isLoaded ? progressTraces(staticTiers, progress, lessonLog, position?.lesson.href ?? null) : emptyTraces(staticTiers)),
    [isLoaded, staticTiers, progress, lessonLog, position],
  );
  const states = useMemo(() => moduleStates(traces), [traces]);

  // "You are here": the module of the lesson to continue (the trace's cursor), else the module opened last.
  const here = lastVisit(visits);
  const hereModuleId =
    cursorModule(traces) ?? (here && lessons.has(`${here.moduleId}/${here.lessonSlug}`) ? here.moduleId : undefined);

  return (
    <>
      <Recommendations
        routes={routes}
        selectedRoute={selectedRoute}
        progress={visits}
        lessons={lessons}
        position={isLoaded ? position : null}
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
        traces={traces}
        moduleStates={states}
        hereModuleId={hereModuleId}
      />
    </>
  );
}
