"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AnalyticsEvent,
  computeCompetency,
  computeEngagement,
  recordEvent,
} from '@/lib/analytics';
import {
  EXERCISE_ANALYTICS_PREFIX,
  EXERCISE_PROGRESS_PREFIX,
  LEARNER_DATA_CHANGED_EVENT,
} from '@/lib/learner-store/keys';
import { safeStorage } from '@/lib/learner-store/storage';

export interface ExerciseProgressSnapshot {
  bestScore: number;
  attempts: number;
  lastPlayed?: string;
}

/**
 * Exercise progress in this browser, under two legacy keys whose formats stay
 * as they are (backups carry them as raw strings):
 * - 'sv-uvm-guide:exercise:<id>': {bestScore, attempts, lastPlayed?}
 * - 'sv-uvm-guide:exercise-analytics:<id>': AnalyticsEvent[], the latest
 *   MAX_ANALYTICS_EVENTS only.
 *
 * Both go through safeStorage, like the learner store and backups: when
 * storage is blocked or full, a score that can't be saved stays in its memory
 * overlay for this visit, where this hook, an import and a backup all see the
 * same value (and the storage note says it isn't saved).
 *
 * Storage is read after mount, never during render, so the server render and
 * the hydrating render both show the empty state and always match. The hook
 * reads again when another tab changes its keys ('storage') and after an
 * import or reset in this tab (LEARNER_DATA_CHANGED_EVENT). Each attempt or
 * interaction builds on a fresh read, so a reset or an import is never
 * overwritten with the numbers this tab had before.
 */
const STORAGE_PREFIX = EXERCISE_PROGRESS_PREFIX;
const ANALYTICS_PREFIX = EXERCISE_ANALYTICS_PREFIX;

/** The analytics history keeps only the latest events (the backup validators use the same cap). */
export const MAX_ANALYTICS_EVENTS = 200;

const EMPTY_PROGRESS: ExerciseProgressSnapshot = Object.freeze({ bestScore: 0, attempts: 0 });
const EMPTY_HISTORY: AnalyticsEvent[] = [];

function nonNegative(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}

/** The stored progress; EMPTY_PROGRESS when absent, unreadable JSON, or on the server. */
function readProgress(exerciseId: string): ExerciseProgressSnapshot {
  const raw = safeStorage.get(`${STORAGE_PREFIX}${exerciseId}`);
  if (!raw) return EMPTY_PROGRESS;
  try {
    const parsed = JSON.parse(raw) as Partial<ExerciseProgressSnapshot> | null;
    if (!parsed || typeof parsed !== 'object') return EMPTY_PROGRESS;
    return {
      bestScore: nonNegative(parsed.bestScore),
      attempts: nonNegative(parsed.attempts),
      lastPlayed: typeof parsed.lastPlayed === 'string' ? parsed.lastPlayed : undefined,
    };
  } catch (error) {
    console.warn(`Failed to read exercise progress for ${exerciseId}`, error);
    return EMPTY_PROGRESS;
  }
}

/** Saves the progress; a value storage refuses stays in safeStorage's memory overlay for this visit. */
function persistProgress(exerciseId: string, snapshot: ExerciseProgressSnapshot): void {
  if (safeStorage.set(`${STORAGE_PREFIX}${exerciseId}`, JSON.stringify(snapshot)) === 'memory-only') {
    console.warn(`Exercise progress for ${exerciseId} is kept for this visit only: storage is blocked or full.`);
  }
}

function isAnalyticsEvent(value: unknown): value is AnalyticsEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as Partial<AnalyticsEvent>;
  return (
    (event.type === 'assessment' || event.type === 'interaction') &&
    typeof event.value === 'number' &&
    Number.isFinite(event.value) &&
    typeof event.timestamp === 'number' &&
    Number.isFinite(event.timestamp)
  );
}

function capHistory(history: AnalyticsEvent[]): AnalyticsEvent[] {
  return history.length > MAX_ANALYTICS_EVENTS ? history.slice(-MAX_ANALYTICS_EVENTS) : history;
}

/** The stored history (the latest MAX_ANALYTICS_EVENTS valid events); EMPTY_HISTORY when absent, unreadable, or on the server. */
function readAnalytics(exerciseId: string): AnalyticsEvent[] {
  const raw = safeStorage.get(`${ANALYTICS_PREFIX}${exerciseId}`);
  if (!raw) return EMPTY_HISTORY;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? capHistory(parsed.filter(isAnalyticsEvent)) : EMPTY_HISTORY;
  } catch (error) {
    console.warn(`Failed to read exercise analytics for ${exerciseId}`, error);
    return EMPTY_HISTORY;
  }
}

/** Saves the latest MAX_ANALYTICS_EVENTS events; a value storage refuses stays in safeStorage's memory overlay for this visit. */
function persistAnalytics(exerciseId: string, history: AnalyticsEvent[]): void {
  if (safeStorage.set(`${ANALYTICS_PREFIX}${exerciseId}`, JSON.stringify(capHistory(history))) === 'memory-only') {
    console.warn(`Exercise analytics for ${exerciseId} are kept for this visit only: storage is blocked or full.`);
  }
}

export interface ExerciseAnalyticsSnapshot {
  history: AnalyticsEvent[];
  competency: number;
  engagement: number;
}

export function useExerciseProgress(exerciseId: string) {
  // Empty until mounted: reading storage here would make the first client render differ from the server HTML.
  const [progress, setProgress] = useState<ExerciseProgressSnapshot>(EMPTY_PROGRESS);
  const [analyticsHistory, setAnalyticsHistory] = useState<AnalyticsEvent[]>(EMPTY_HISTORY);

  useEffect(() => {
    const progressKey = `${STORAGE_PREFIX}${exerciseId}`;
    const analyticsKey = `${ANALYTICS_PREFIX}${exerciseId}`;
    const reload = () => {
      setProgress(readProgress(exerciseId));
      setAnalyticsHistory(readAnalytics(exerciseId));
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === progressKey || event.key === analyticsKey) reload();
    };
    reload();
    window.addEventListener('storage', onStorage);
    window.addEventListener(LEARNER_DATA_CHANGED_EVENT, reload);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(LEARNER_DATA_CHANGED_EVENT, reload);
    };
  }, [exerciseId]);

  // Each change builds on a fresh read: the saved value, or the memory copy safeStorage keeps when it can't save.
  const appendEvent = useCallback(
    (event: AnalyticsEvent) => {
      const history = capHistory(recordEvent(readAnalytics(exerciseId), event));
      persistAnalytics(exerciseId, history);
      setAnalyticsHistory(history);
    },
    [exerciseId],
  );

  const recordAttempt = useCallback(
    (score: number) => {
      const previous = readProgress(exerciseId);
      const next: ExerciseProgressSnapshot = {
        bestScore: Math.max(previous.bestScore, score),
        attempts: previous.attempts + 1,
        lastPlayed: new Date().toISOString(),
      };
      persistProgress(exerciseId, next);
      setProgress(next);
      appendEvent({
        type: 'assessment',
        value: score,
        timestamp: Date.now(),
      });
    },
    [exerciseId, appendEvent],
  );

  const resetProgress = useCallback(() => {
    setProgress(EMPTY_PROGRESS);
    setAnalyticsHistory(EMPTY_HISTORY);
    safeStorage.remove(`${STORAGE_PREFIX}${exerciseId}`);
    safeStorage.remove(`${ANALYTICS_PREFIX}${exerciseId}`);
  }, [exerciseId]);

  const logInteraction = useCallback(() => {
    appendEvent({
      type: 'interaction',
      value: 1,
      timestamp: Date.now(),
    });
  }, [appendEvent]);

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
