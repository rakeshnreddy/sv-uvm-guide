'use client';

import { useState, useEffect, useCallback } from 'react';
import { Tier, Topic, tiers, getModules } from '@/lib/curriculum-data';

// Define the shape of our progress data
export interface ProgressData {
  [moduleId: string]: {
    completedLessons: string[];
  };
}

const STORAGE_KEY = 'curriculumProgress';
const TIER_UNLOCK_THRESHOLD = 0.75; // 75% of previous tier must be complete

// --- Hook Definition ---
export function useCurriculumProgress() {
  const [progress, setProgress] = useState<ProgressData>({});
  const [isLoaded, setIsLoaded] = useState(false);

  // Load progress from localStorage on initial client-side render
  useEffect(() => {
    try {
      const savedProgress = localStorage.getItem(STORAGE_KEY);
      if (savedProgress) {
        setProgress(JSON.parse(savedProgress));
      }
    } catch (error) {
      console.error("Failed to load progress from localStorage", error);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save progress to localStorage whenever it changes
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
      } catch (error) {
        console.error("Failed to save progress to localStorage", error);
      }
    }
  }, [progress, isLoaded]);

  const getModuleProgress = useCallback((moduleId: string): number => {
    const moduleData = tiers.flatMap(t => getModules(t)).find(m => m.id === moduleId);
    if (!moduleData || !progress[moduleId]) {
      return 0;
    }
    const completedCount = progress[moduleId].completedLessons.length;
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


  // This function would be called from a topic page to mark a lesson as complete
  const completeLesson = useCallback((moduleId: string, lessonSlug: string) => {
    setProgress(prev => {
      const newProgress = { ...prev };
      const moduleProgress = newProgress[moduleId] || { completedLessons: [] };

      if (!moduleProgress.completedLessons.includes(lessonSlug)) {
        moduleProgress.completedLessons = [...moduleProgress.completedLessons, lessonSlug];
      }

      newProgress[moduleId] = moduleProgress;
      return newProgress;
    });
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
    completeLesson,
    // A function to reset progress for testing
    _resetProgress: () => setProgress({}),
  };
}
