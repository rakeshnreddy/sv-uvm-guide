'use client';

import { useMemo } from 'react';

import { useRecord } from '@/lib/learner-store/react';
import { curriculumProgressRecord, lessonLogRecord } from '@/lib/learner-store/repositories/lessons';

import { continueLesson, hasLessonPosition, lastOpenedAt, type ContinueReason, type LandingLesson } from './landing-resume';

export interface LandingResume {
  /** The lesson to continue (continueLesson), or null. Always null in the server render and the hydrating render. */
  lesson: LandingLesson | null;
  /** The lesson opened last; differs from `lesson` when that one is marked done. */
  lastOpened: LandingLesson | null;
  reason: ContinueReason | null;
  /** The browser holds a lesson visit (the inline script's test). */
  hasPosition: boolean;
  /** When the browser last opened `lastOpened`, epoch ms. */
  lastVisitedAt: number | null;
}

/** The landing page's lesson position, read from the learner store after hydration. */
export function useLandingResume(lessons: readonly LandingLesson[]): LandingResume {
  const lessonLog = useRecord(lessonLogRecord);
  const progress = useRecord(curriculumProgressRecord);
  return useMemo(() => {
    const position = continueLesson(lessonLog, progress, lessons);
    return {
      lesson: position?.lesson ?? null,
      lastOpened: position?.lastOpened ?? null,
      reason: position?.reason ?? null,
      hasPosition: hasLessonPosition(lessonLog, progress),
      lastVisitedAt: position ? lastOpenedAt(lessonLog, progress, position.lastOpened.href) : null,
    };
  }, [lessonLog, progress, lessons]);
}
