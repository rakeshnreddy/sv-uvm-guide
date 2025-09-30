"use client";

import { useEffect } from 'react';
import { useCurriculumProgress } from '@/hooks/useCurriculumProgress';

type LessonVisitTrackerProps = {
  moduleId: string;
  lessonSlug: string;
};

const LessonVisitTracker = ({ moduleId, lessonSlug }: LessonVisitTrackerProps) => {
  const { recordLessonVisit } = useCurriculumProgress();

  useEffect(() => {
    recordLessonVisit(moduleId, lessonSlug);
  }, [moduleId, lessonSlug, recordLessonVisit]);

  return null;
};

export default LessonVisitTracker;
