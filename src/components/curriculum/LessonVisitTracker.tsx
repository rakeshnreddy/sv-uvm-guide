"use client";

import { useEffect, useRef } from 'react';

import { recordLessonVisit } from '@/hooks/useCurriculumProgress';
import { recordActivity } from '@/lib/learner-store/repositories/activity';
import { logLessonVisit } from '@/lib/learner-store/repositories/lessons';

type LessonVisitTrackerProps = {
  moduleId: string;
  lessonSlug: string;
  /** Canonical lesson path, '/curriculum/<Tier>/<Module>/<lesson>'. */
  lessonPath: string;
};

/**
 * Records one visit per lesson view, in this browser: the module's last opened
 * lesson ('curriculumProgress', which /curriculum reads), the lesson log and
 * today's 'lesson' activity. Every write is an update on a fresh read, after
 * mount. Renders nothing.
 */
const LessonVisitTracker = ({ moduleId, lessonSlug, lessonPath }: LessonVisitTrackerProps) => {
  // React StrictMode runs mount effects twice in development; count the view once.
  const recordedPath = useRef<string | null>(null);

  useEffect(() => {
    if (recordedPath.current === lessonPath) return;
    recordedPath.current = lessonPath;
    const now = Date.now();
    recordLessonVisit(moduleId, lessonSlug, now);
    logLessonVisit(lessonPath, now);
    recordActivity('lesson', now);
  }, [moduleId, lessonSlug, lessonPath]);

  return null;
};

export default LessonVisitTracker;
