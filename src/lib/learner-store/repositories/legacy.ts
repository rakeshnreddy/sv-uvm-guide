/**
 * Read-only access to the legacy keys other modules own, plus the validators
 * backups use for them. Backups carry these keys as raw strings, so each
 * validator takes the raw string and returns the normalized raw string to
 * write, or null to skip it:
 * - 'curriculumProgress': bare JSON (curriculumProgressRecord's validator).
 * - 'svuvm.learningRoute': a bare RouteId string, owned by learning-route-state.
 * - 'sv-uvm-guide:exercise:<id>': {bestScore, attempts, lastPlayed?}, owned by useExerciseProgress.
 * - 'sv-uvm-guide:exercise-analytics:<id>': an array of analytics events,
 *   owned by useExerciseProgress; at most the latest 200 are kept.
 */
import { isRouteId, type RouteId } from '@/lib/learning-route-state';

import {
  CURRICULUM_PROGRESS_KEY,
  EXERCISE_ANALYTICS_PREFIX,
  EXERCISE_PROGRESS_PREFIX,
  ROUTE_STORAGE_KEY,
} from '../keys';
import { isFiniteNumber, isPlainObject, isTimestamp } from '../record';
import { safeStorage } from '../storage';
import { parseCurriculumProgress } from './lessons';

export const LEGACY_EXERCISE_MAX_EVENTS = 200;
/** Longest raw value accepted for one legacy key on import. */
export const LEGACY_RAW_MAX_CHARS = 200_000;

/** The shape useExerciseProgress stores under 'sv-uvm-guide:exercise:<id>'. */
export interface LegacyExerciseProgress {
  bestScore: number;
  attempts: number;
  lastPlayed?: string;
}

/** The shape useExerciseProgress stores under 'sv-uvm-guide:exercise-analytics:<id>' (src/lib/analytics.ts AnalyticsEvent). */
export interface LegacyAnalyticsEvent {
  type: 'assessment' | 'interaction';
  value: number;
  timestamp: number;
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

/** Validates an exercise progress raw value: numeric, non-negative bestScore and attempts. */
export function parseExerciseProgressRaw(raw: string | null | undefined): LegacyExerciseProgress | null {
  if (typeof raw !== 'string' || raw.length > LEGACY_RAW_MAX_CHARS) return null;
  const data = parseJson(raw);
  if (!isPlainObject(data)) return null;
  const { bestScore, attempts, lastPlayed } = data;
  if (!isFiniteNumber(bestScore) || bestScore < 0) return null;
  if (!isFiniteNumber(attempts) || attempts < 0 || !Number.isInteger(attempts)) return null;
  const progress: LegacyExerciseProgress = { bestScore, attempts };
  if (typeof lastPlayed === 'string' && !Number.isNaN(Date.parse(lastPlayed))) progress.lastPlayed = lastPlayed;
  return progress;
}

function parseAnalyticsEvent(value: unknown): LegacyAnalyticsEvent | null {
  if (!isPlainObject(value)) return null;
  if (value.type !== 'assessment' && value.type !== 'interaction') return null;
  if (!isFiniteNumber(value.value) || !isTimestamp(value.timestamp)) return null;
  return { type: value.type, value: value.value, timestamp: value.timestamp };
}

/**
 * Validates an exercise analytics raw value: an array of events, malformed
 * events dropped and only the latest LEGACY_EXERCISE_MAX_EVENTS kept. Null for
 * anything that is not an array, or a non-empty array with no valid event.
 */
export function parseExerciseAnalyticsRaw(raw: string | null | undefined): LegacyAnalyticsEvent[] | null {
  if (typeof raw !== 'string' || raw.length > LEGACY_RAW_MAX_CHARS) return null;
  const data = parseJson(raw);
  if (!Array.isArray(data)) return null;
  const events = data.map(parseAnalyticsEvent).filter((event): event is LegacyAnalyticsEvent => event !== null);
  if (data.length > 0 && events.length === 0) return null;
  return events.slice(-LEGACY_EXERCISE_MAX_EVENTS);
}

/** True for a stored route choice: exactly a RouteId string. */
export function isValidRouteRaw(raw: unknown): raw is RouteId {
  return isRouteId(raw);
}

/** Validates the raw 'curriculumProgress' value. */
export function parseCurriculumProgressRaw(raw: string | null | undefined): ReturnType<typeof parseCurriculumProgress> {
  if (typeof raw !== 'string' || raw.length > LEGACY_RAW_MAX_CHARS) return null;
  return parseCurriculumProgress(parseJson(raw));
}

/**
 * The normalized raw string to store for a legacy key, or null when the key is
 * not a legacy key or the value fails its validator. Used by backup import.
 */
export function normalizeLegacyRaw(key: string, raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  if (key === ROUTE_STORAGE_KEY) return isValidRouteRaw(raw) ? raw : null;
  if (key === CURRICULUM_PROGRESS_KEY) {
    const progress = parseCurriculumProgressRaw(raw);
    return progress ? JSON.stringify(progress) : null;
  }
  if (key.startsWith(EXERCISE_ANALYTICS_PREFIX) && key.length > EXERCISE_ANALYTICS_PREFIX.length) {
    const events = parseExerciseAnalyticsRaw(raw);
    return events ? JSON.stringify(events) : null;
  }
  if (key.startsWith(EXERCISE_PROGRESS_PREFIX) && key.length > EXERCISE_PROGRESS_PREFIX.length) {
    const progress = parseExerciseProgressRaw(raw);
    return progress ? JSON.stringify(progress) : null;
  }
  return null;
}

export interface StoredExerciseProgress {
  exerciseId: string;
  progress: LegacyExerciseProgress;
}

/** Every readable exercise progress entry in this browser, sorted by exercise id. Empty on the server. */
export function readExerciseProgress(): StoredExerciseProgress[] {
  const entries: StoredExerciseProgress[] = [];
  for (const key of safeStorage.keys(EXERCISE_PROGRESS_PREFIX)) {
    const exerciseId = key.slice(EXERCISE_PROGRESS_PREFIX.length);
    if (!exerciseId) continue;
    const progress = parseExerciseProgressRaw(safeStorage.get(key));
    if (progress) entries.push({ exerciseId, progress });
  }
  return entries.sort((a, b) => (a.exerciseId < b.exerciseId ? -1 : a.exerciseId > b.exerciseId ? 1 : 0));
}

/** The raw stored route choice (normally a RouteId), or null. Null on the server. */
export function readSelectedRouteRaw(): string | null {
  return safeStorage.get(ROUTE_STORAGE_KEY);
}

/** Every legacy key and its raw value, for export. Empty on the server. */
export function readLegacyRawEntries(): Record<string, string> {
  const entries: Record<string, string> = {};
  const keys = [
    CURRICULUM_PROGRESS_KEY,
    ROUTE_STORAGE_KEY,
    ...safeStorage.keys(EXERCISE_PROGRESS_PREFIX),
    ...safeStorage.keys(EXERCISE_ANALYTICS_PREFIX),
  ];
  for (const key of keys) {
    const raw = safeStorage.get(key);
    if (raw !== null) entries[key] = raw;
  }
  return entries;
}
