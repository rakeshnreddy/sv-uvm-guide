'use client';

import { useMemo } from 'react';

import { continueLesson, type ContinueLessonEntry, type ContinuePosition } from '@/lib/continue-lesson';
import { useRecord } from '@/lib/learner-store/react';
import { curriculumProgressRecord, lessonLogRecord } from '@/lib/learner-store/repositories/lessons';

/**
 * The lesson to continue (the one rule in src/lib/continue-lesson.ts), read
 * from the learner store. Null in the server render and the hydrating render,
 * and whenever the browser holds no position on a lesson that still exists.
 */
export function useContinueLesson<L extends ContinueLessonEntry>(lessons: readonly L[]): ContinuePosition<L> | null {
  const lessonLog = useRecord(lessonLogRecord);
  const progress = useRecord(curriculumProgressRecord);
  return useMemo(() => continueLesson(lessonLog, progress, lessons), [lessonLog, progress, lessons]);
}
