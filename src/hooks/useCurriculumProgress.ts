'use client';

/**
 * Curriculum progress: per module, the lessons marked done and the last lesson
 * opened. It is saved in this browser under the legacy 'curriculumProgress'
 * key, in its existing bare-JSON format, through curriculumProgressRecord.
 *
 * Every hook instance and every tab share one snapshot (useRecord over the
 * learner store), so two instances on a page can never overwrite each other.
 * Writes go through update(fn), which re-reads storage first, and run only
 * from event handlers or effects, never during render. The first write over a
 * value that cannot be read copies it to
 * 'sv-uvm-guide:recovered:curriculumProgress', so nothing stored is lost.
 */
import { useCallback } from 'react';

import { getModules, tiers } from '@/lib/curriculum-data';
import { useHydrated, useRecord } from '@/lib/learner-store/react';
import type { WriteOutcome } from '@/lib/learner-store/record';
import {
  curriculumProgressRecord,
  type CurriculumModuleProgress,
  type CurriculumProgressData,
} from '@/lib/learner-store/repositories/lessons';

/** One module's progress: completedLessons, completedAt (slug to epoch ms), lastVisitedAt and lastVisitedLesson. */
export type ModuleProgress = CurriculumModuleProgress;

/** Module id (the section slug) to its progress; the format stored under 'curriculumProgress'. */
export type ProgressData = CurriculumProgressData;

const EMPTY_MODULE: ModuleProgress = Object.freeze({ completedLessons: Object.freeze([]) as unknown as string[] });

function moduleEntry(data: ProgressData, moduleId: string): ModuleProgress {
  return data[moduleId] ?? EMPTY_MODULE;
}

/** Remembers the lesson as the module's last opened one, on a fresh read. */
export function recordLessonVisit(moduleId: string, lessonSlug: string, now: number = Date.now()): WriteOutcome {
  return curriculumProgressRecord.update((data) => {
    const existing = moduleEntry(data, moduleId);
    return {
      ...data,
      [moduleId]: { ...existing, lastVisitedAt: now, lastVisitedLesson: lessonSlug },
    };
  });
}

/**
 * Marks a lesson done (once; the first completion time is kept in
 * completedAt) and remembers it as the module's last opened lesson.
 */
export function completeLesson(moduleId: string, lessonSlug: string, now: number = Date.now()): WriteOutcome {
  return curriculumProgressRecord.update((data) => {
    const existing = moduleEntry(data, moduleId);
    const completedLessons = existing.completedLessons.includes(lessonSlug)
      ? existing.completedLessons
      : [...existing.completedLessons, lessonSlug];
    return {
      ...data,
      [moduleId]: {
        ...existing,
        completedLessons,
        completedAt: { ...existing.completedAt, [lessonSlug]: existing.completedAt?.[lessonSlug] ?? now },
        lastVisitedAt: now,
        lastVisitedLesson: lessonSlug,
      },
    };
  });
}

/** Clears a lesson's done mark. Writes nothing when it was not marked done. */
export function uncompleteLesson(moduleId: string, lessonSlug: string): WriteOutcome {
  return curriculumProgressRecord.update((data) => {
    const existing = data[moduleId];
    if (!existing) return data;
    const wasDone = existing.completedLessons.includes(lessonSlug);
    const hasTime = existing.completedAt?.[lessonSlug] !== undefined;
    if (!wasDone && !hasTime) return data;
    const next: ModuleProgress = {
      ...existing,
      completedLessons: existing.completedLessons.filter((slug) => slug !== lessonSlug),
    };
    const completedAt = Object.fromEntries(
      Object.entries(existing.completedAt ?? {}).filter(([slug]) => slug !== lessonSlug),
    );
    if (Object.keys(completedAt).length > 0) next.completedAt = completedAt;
    else delete next.completedAt;
    return { ...data, [moduleId]: next };
  });
}

/** Saves empty progress (tests and debugging). */
export function resetCurriculumProgress(): WriteOutcome {
  return curriculumProgressRecord.update(() => ({}));
}

const moduleIndex = new Map(tiers.flatMap((tier) => getModules(tier)).map((module) => [module.id, module]));

// --- Hook Definition ---
export function useCurriculumProgress() {
  // The stored progress after hydration; {} during the server render and the hydrating render.
  const progress = useRecord(curriculumProgressRecord);
  const isLoaded = useHydrated();

  /** Percentage of the module's lessons marked done (lessons that no longer exist do not count). */
  const getModuleProgress = useCallback((moduleId: string): number => {
    const moduleData = moduleIndex.get(moduleId);
    const entry = progress[moduleId];
    if (!moduleData || !entry) {
      return 0;
    }
    const slugs = new Set(moduleData.lessons.map((lesson) => lesson.slug));
    const completedCount = entry.completedLessons.filter((slug) => slugs.has(slug)).length;
    const totalLessons = moduleData.lessons.length;
    return totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;
  }, [progress]);

  const getTierProgress = useCallback((tierId: string): number => {
    const tierData = tiers.find(t => t.slug === tierId);
    if (!tierData) return 0;

    const moduleProgressValues = getModules(tierData).map(m => getModuleProgress(m.id));
    if (moduleProgressValues.length === 0) return 0;

    const totalProgress = moduleProgressValues.reduce((sum, current) => sum + current, 0);
    return Math.round(totalProgress / moduleProgressValues.length);
  }, [getModuleProgress]);

  // Currently all tiers are accessible without completion requirements
  const isTierUnlocked = useCallback((_tierId: string): boolean => {
    return true;
  }, []);

  // A helper to check if a specific module is locked
  // Modules are never locked so users can freely explore
  const isModuleLocked = useCallback(
    (_moduleId: string, _tierId: string): boolean => {
      return false;
    },
    []
  );

  return {
    progress,
    isLoaded,
    getModuleProgress,
    getTierProgress,
    isTierUnlocked,
    isModuleLocked,
    recordLessonVisit,
    completeLesson,
    uncompleteLesson,
    // A function to reset progress for testing
    _resetProgress: resetCurriculumProgress,
  };
}
