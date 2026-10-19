/**
 * Lesson visits and curriculum progress.
 *
 * lessonPath is the canonical pathname '/curriculum/<Tier>/<Module>/<lesson>'
 * with no trailing slash, query or hash (canonicalLessonPath).
 *
 * curriculumProgressRecord keeps the legacy 'curriculumProgress' key in its
 * existing bare-JSON format (today's ProgressData from useCurriculumProgress),
 * so progress saved before this store reads unchanged.
 */
import { CURRICULUM_PROGRESS_KEY, LESSONS_KEY } from '../keys';
import {
  defineRecord,
  isNonEmptyString,
  isNonNegativeInteger,
  isPlainObject,
  isTimestamp,
  recordOf,
  stringArray,
  timestampOr,
  type WriteOutcome,
} from '../record';

export const LESSON_LOG_MAX_CHARS = 200_000;
export const CURRICULUM_PROGRESS_MAX_CHARS = 200_000;

/**
 * The canonical lesson path for a pathname, or null when it is not a lesson
 * under /curriculum/. Drops the query, the hash and trailing slashes.
 */
export function canonicalLessonPath(pathname: string | null | undefined): string | null {
  if (!pathname) return null;
  const path = pathname.split(/[?#]/, 1)[0].replace(/\/+$/, '');
  if (!/^\/curriculum\/[^/]+\/[^/]+(\/[^/]+)*$/.test(path)) return null;
  return path;
}

function isLessonPathKey(key: string): boolean {
  return key.startsWith('/') && !/[?#]/.test(key) && (key.length === 1 || !key.endsWith('/'));
}

// ---------------------------------------------------------------------------
// Lesson log
// ---------------------------------------------------------------------------

export interface LessonVisit {
  /** Epoch ms. */
  firstVisitedAt: number;
  lastVisitedAt: number;
  visits: number;
}

export interface LessonLogData {
  lessons: Record<string, LessonVisit>;
}

const EMPTY_LESSON_LOG: LessonLogData = Object.freeze({
  lessons: Object.freeze({}) as Record<string, LessonVisit>,
});

function parseLessonVisit(value: unknown, key: string): LessonVisit | null {
  if (!isLessonPathKey(key) || !isPlainObject(value)) return null;
  if (!isTimestamp(value.lastVisitedAt)) return null;
  const firstVisitedAt = timestampOr(value.firstVisitedAt, value.lastVisitedAt);
  return {
    firstVisitedAt: Math.min(firstVisitedAt, value.lastVisitedAt),
    lastVisitedAt: value.lastVisitedAt,
    visits: isNonNegativeInteger(value.visits) && value.visits > 0 ? value.visits : 1,
  };
}

export function parseLessonLog(data: unknown): LessonLogData | null {
  if (!isPlainObject(data)) return null;
  return { lessons: recordOf(data.lessons, parseLessonVisit) };
}

export function mergeLessonLog(local: LessonLogData, incoming: LessonLogData): LessonLogData {
  const lessons: Record<string, LessonVisit> = { ...local.lessons };
  for (const [path, visit] of Object.entries(incoming.lessons)) {
    const existing = lessons[path];
    lessons[path] = existing
      ? {
          firstVisitedAt: Math.min(existing.firstVisitedAt, visit.firstVisitedAt),
          lastVisitedAt: Math.max(existing.lastVisitedAt, visit.lastVisitedAt),
          visits: Math.max(existing.visits, visit.visits),
        }
      : visit;
  }
  return { lessons };
}

export const lessonLogRecord = defineRecord<LessonLogData>({
  key: LESSONS_KEY,
  version: 1,
  empty: EMPTY_LESSON_LOG,
  parse: parseLessonLog,
  maxChars: LESSON_LOG_MAX_CHARS,
  merge: mergeLessonLog,
});

/** Counts a visit to a lesson (on a fresh read, so other tabs' visits are kept). */
export function logLessonVisit(lessonPath: string, now: number = Date.now()): WriteOutcome {
  return lessonLogRecord.update((data) => {
    const existing = data.lessons[lessonPath];
    const visit: LessonVisit = existing
      ? { firstVisitedAt: existing.firstVisitedAt, lastVisitedAt: Math.max(existing.lastVisitedAt, now), visits: existing.visits + 1 }
      : { firstVisitedAt: now, lastVisitedAt: now, visits: 1 };
    return { lessons: { ...data.lessons, [lessonPath]: visit } };
  });
}

// ---------------------------------------------------------------------------
// Curriculum progress (legacy key 'curriculumProgress', bare JSON)
// ---------------------------------------------------------------------------

export interface CurriculumModuleProgress {
  completedLessons: string[];
  /** Lesson slug to the epoch ms it was marked complete. */
  completedAt?: Record<string, number>;
  lastVisitedAt?: number;
  lastVisitedLesson?: string;
}

/** Module id to its progress; backward compatible with useCurriculumProgress's ProgressData. */
export type CurriculumProgressData = Record<string, CurriculumModuleProgress>;

const EMPTY_CURRICULUM_PROGRESS: CurriculumProgressData = Object.freeze({}) as CurriculumProgressData;

function parseModuleProgress(value: unknown): CurriculumModuleProgress | null {
  if (!isPlainObject(value)) return null;
  const progress: CurriculumModuleProgress = { completedLessons: stringArray(value.completedLessons) };
  if (value.completedAt !== undefined) {
    const completedAt = recordOf(value.completedAt, (time) => (isTimestamp(time) ? time : null));
    if (Object.keys(completedAt).length > 0) progress.completedAt = completedAt;
  }
  if (isTimestamp(value.lastVisitedAt)) progress.lastVisitedAt = value.lastVisitedAt;
  if (isNonEmptyString(value.lastVisitedLesson)) progress.lastVisitedLesson = value.lastVisitedLesson;
  return progress;
}

export function parseCurriculumProgress(data: unknown): CurriculumProgressData | null {
  if (!isPlainObject(data)) return null;
  return recordOf(data, parseModuleProgress);
}

function mergeModuleProgress(local: CurriculumModuleProgress, incoming: CurriculumModuleProgress): CurriculumModuleProgress {
  const merged: CurriculumModuleProgress = {
    completedLessons: [...new Set([...local.completedLessons, ...incoming.completedLessons])],
  };
  const completedAt: Record<string, number> = { ...(incoming.completedAt ?? {}) };
  for (const [slug, time] of Object.entries(local.completedAt ?? {})) {
    completedAt[slug] = completedAt[slug] === undefined ? time : Math.min(completedAt[slug], time);
  }
  if (Object.keys(completedAt).length > 0) merged.completedAt = completedAt;
  const latest = (incoming.lastVisitedAt ?? -1) > (local.lastVisitedAt ?? -1) ? incoming : local;
  if (latest.lastVisitedAt !== undefined) merged.lastVisitedAt = latest.lastVisitedAt;
  if (latest.lastVisitedLesson !== undefined) merged.lastVisitedLesson = latest.lastVisitedLesson;
  return merged;
}

/** Completed lessons are combined (earliest completion time kept); the latest visit wins. */
export function mergeCurriculumProgress(local: CurriculumProgressData, incoming: CurriculumProgressData): CurriculumProgressData {
  const merged: CurriculumProgressData = { ...local };
  for (const [moduleId, progress] of Object.entries(incoming)) {
    const existing = merged[moduleId];
    merged[moduleId] = existing ? mergeModuleProgress(existing, progress) : progress;
  }
  return merged;
}

export const curriculumProgressRecord = defineRecord<CurriculumProgressData>({
  key: CURRICULUM_PROGRESS_KEY,
  version: 1,
  empty: EMPTY_CURRICULUM_PROGRESS,
  parse: parseCurriculumProgress,
  legacyRaw: true,
  maxChars: CURRICULUM_PROGRESS_MAX_CHARS,
  merge: mergeCurriculumProgress,
});
