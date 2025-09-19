"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AnalyticsEvent,
  computeCompetency,
  computeEngagement,
  recordEvent,
} from '@/lib/analytics';

export interface ExerciseProgressSnapshot {
  bestScore: number;
  attempts: number;
  lastPlayed?: string;
}

const STORAGE_PREFIX = 'sv-uvm-guide:exercise:';
const ANALYTICS_PREFIX = 'sv-uvm-guide:exercise-analytics:';

function readProgress(exerciseId: string): ExerciseProgressSnapshot {
  if (typeof window === 'undefined') {
    return { bestScore: 0, attempts: 0 };
  }
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${exerciseId}`);
    if (!raw) return { bestScore: 0, attempts: 0 };
    const parsed = JSON.parse(raw) as ExerciseProgressSnapshot;
    return {
      bestScore: parsed.bestScore ?? 0,
      attempts: parsed.attempts ?? 0,
      lastPlayed: parsed.lastPlayed,
    };
  } catch (error) {
    console.warn(`Failed to read exercise progress for ${exerciseId}`, error);
    return { bestScore: 0, attempts: 0 };
  }
}

function persistProgress(exerciseId: string, snapshot: ExerciseProgressSnapshot) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${exerciseId}`, JSON.stringify(snapshot));
  } catch (error) {
    console.warn(`Failed to persist exercise progress for ${exerciseId}`, error);
  }
}

function readAnalytics(exerciseId: string): AnalyticsEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(`${ANALYTICS_PREFIX}${exerciseId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AnalyticsEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn(`Failed to read exercise analytics for ${exerciseId}`, error);
    return [];
  }
}

function persistAnalytics(exerciseId: string, history: AnalyticsEvent[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${ANALYTICS_PREFIX}${exerciseId}`, JSON.stringify(history));
  } catch (error) {
    console.warn(`Failed to persist exercise analytics for ${exerciseId}`, error);
  }
}

export interface ExerciseAnalyticsSnapshot {
  history: AnalyticsEvent[];
  competency: number;
  engagement: number;
}

export function useExerciseProgress(exerciseId: string) {
  const [progress, setProgress] = useState<ExerciseProgressSnapshot>(() => readProgress(exerciseId));
  const [analyticsHistory, setAnalyticsHistory] = useState<AnalyticsEvent[]>(() => readAnalytics(exerciseId));

  useEffect(() => {
    setProgress(readProgress(exerciseId));
    setAnalyticsHistory(readAnalytics(exerciseId));
  }, [exerciseId]);

  const recordAttempt = useCallback(
    (score: number) => {
      setProgress(prev => {
        const next: ExerciseProgressSnapshot = {
          bestScore: Math.max(prev.bestScore, score),
          attempts: prev.attempts + 1,
          lastPlayed: new Date().toISOString(),
        };
        persistProgress(exerciseId, next);
        return next;
      });
      setAnalyticsHistory(prev => {
        const event: AnalyticsEvent = {
          type: 'assessment',
          value: score,
          timestamp: Date.now(),
        };
        const history = recordEvent(prev, event);
        persistAnalytics(exerciseId, history);
        return history;
      });
    },
    [exerciseId],
  );

  const resetProgress = useCallback(() => {
    setProgress({ bestScore: 0, attempts: 0 });
    setAnalyticsHistory([]);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(`${STORAGE_PREFIX}${exerciseId}`);
      window.localStorage.removeItem(`${ANALYTICS_PREFIX}${exerciseId}`);
    }
  }, [exerciseId]);

  const logInteraction = useCallback(() => {
    setAnalyticsHistory(prev => {
      const event: AnalyticsEvent = {
        type: 'interaction',
        value: 1,
        timestamp: Date.now(),
      };
      const history = recordEvent(prev, event);
      persistAnalytics(exerciseId, history);
      return history;
    });
  }, [exerciseId]);

  const formatted = useMemo(() => {
    const lastPlayedDate = progress.lastPlayed ? new Date(progress.lastPlayed) : undefined;
    return {
      ...progress,
      lastPlayedLabel: lastPlayedDate ? lastPlayedDate.toLocaleString() : undefined,
    };
  }, [progress]);

  const analytics = useMemo<ExerciseAnalyticsSnapshot>(() => ({
    history: analyticsHistory,
    competency: computeCompetency(analyticsHistory),
    engagement: computeEngagement(analyticsHistory),
  }), [analyticsHistory]);

  return { progress: formatted, recordAttempt, resetProgress, logInteraction, analytics };
}
