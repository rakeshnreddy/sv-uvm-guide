/**
 * Placement attempts and lesson quiz results.
 *
 * Quiz results are keyed `${lessonPath}#${quizId}`, where quizId is an 8-hex
 * FNV-1a hash of the question texts (quizIdFromQuestions), so a lesson with
 * two quizzes keeps both. lessonPath is always a canonical lesson path
 * (canonicalLessonPath), so a stored or imported result never holds another
 * kind of link.
 *
 * The quiz map is bounded: editing a quiz's questions gives it a new quizId and
 * leaves the old result behind, so only the newest QUIZ_RESULTS_PER_LESSON_MAX
 * results per lesson and the newest QUIZ_RESULTS_MAX overall are kept (by
 * lastAt). recordQuizResult and mergeAssessmentData both apply it, so neither
 * stale results nor an import can fill the record up.
 */
import { isRouteId, type RouteId } from '@/lib/learning-route-state';

import { ASSESSMENTS_KEY, fnv1a32Hex } from '../keys';
import {
  defineRecord,
  isFiniteNumber,
  isNonEmptyString,
  isNonNegativeInteger,
  isPlainObject,
  isTimestamp,
  recordOf,
  timestampOr,
  type WriteOutcome,
} from '../record';
import { canonicalLessonPath } from './lessons';

export const ASSESSMENTS_MAX_CHARS = 200_000;
export const PLACEMENT_MAX_ATTEMPTS = 10;
/** Quiz results kept per lesson, newest first: a lesson has at most two quizzes, plus one left by an edit. */
export const QUIZ_RESULTS_PER_LESSON_MAX = 3;
/** Quiz results kept in all, newest first. The curriculum has fewer quizzes than this. */
export const QUIZ_RESULTS_MAX = 400;
const PLACEMENT_MAX_RESPONSES = 100;

export interface PlacementResponse {
  questionId: string;
  optionId: string;
}

export interface PlacementCategoryResult {
  id: string;
  /** Fraction correct, from 0 to 1. */
  percent: number;
}

export interface PlacementAttempt {
  assessmentVersion: string;
  scoringVersion: string;
  responses: PlacementResponse[];
  /** Recommended curriculum tier, 1 to 4. */
  tier: number;
  routeId: RouteId;
  /** Overall fraction correct, from 0 to 1 (PlacementResults.overallPercent). */
  percent: number;
  categories: PlacementCategoryResult[];
  /** Epoch ms. */
  completedAt: number;
}

export interface QuizResult {
  lessonPath: string;
  /** Best number of correct answers. */
  best: number;
  /** Correct answers in the latest attempt. */
  last: number;
  /** Questions in the quiz. */
  total: number;
  attempts: number;
  /** Epoch ms of the latest attempt. */
  lastAt: number;
}

export interface AssessmentData {
  /** Newest first, at most PLACEMENT_MAX_ATTEMPTS. */
  placement: PlacementAttempt[];
  /** Keyed `${lessonPath}#${quizId}`. */
  quizzes: Record<string, QuizResult>;
}

const EMPTY_ASSESSMENTS: AssessmentData = Object.freeze({
  placement: Object.freeze([]) as unknown as PlacementAttempt[],
  quizzes: Object.freeze({}) as Record<string, QuizResult>,
});

function isFraction(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0 && value <= 1;
}

function parseResponses(value: unknown): PlacementResponse[] {
  if (!Array.isArray(value)) return [];
  const responses: PlacementResponse[] = [];
  for (const item of value) {
    if (!isPlainObject(item) || !isNonEmptyString(item.questionId) || !isNonEmptyString(item.optionId)) continue;
    responses.push({ questionId: item.questionId, optionId: item.optionId });
    if (responses.length === PLACEMENT_MAX_RESPONSES) break;
  }
  return responses;
}

function parseCategories(value: unknown): PlacementCategoryResult[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => isPlainObject(item) && isNonEmptyString(item.id) && isFraction(item.percent))
    .map((item) => ({ id: item.id as string, percent: item.percent as number }));
}

export function parsePlacementAttempt(value: unknown): PlacementAttempt | null {
  if (!isPlainObject(value)) return null;
  if (!isNonEmptyString(value.assessmentVersion) || !isNonEmptyString(value.scoringVersion)) return null;
  if (!isNonNegativeInteger(value.tier) || value.tier < 1 || value.tier > 4) return null;
  if (!isRouteId(value.routeId) || !isFraction(value.percent)) return null;
  if (!isTimestamp(value.completedAt)) return null;
  return {
    assessmentVersion: value.assessmentVersion,
    scoringVersion: value.scoringVersion,
    responses: parseResponses(value.responses),
    tier: value.tier,
    routeId: value.routeId,
    percent: value.percent,
    categories: parseCategories(value.categories),
    completedAt: value.completedAt,
  };
}

function parseQuizResult(value: unknown, key: string): QuizResult | null {
  if (!isPlainObject(value) || !isNonEmptyString(value.lessonPath)) return null;
  if (canonicalLessonPath(value.lessonPath) !== value.lessonPath) return null;
  if (!key.startsWith(`${value.lessonPath}#`)) return null;
  if (!isNonNegativeInteger(value.total) || !isNonNegativeInteger(value.best) || !isNonNegativeInteger(value.last)) return null;
  if (value.best > value.total || value.last > value.total) return null;
  return {
    lessonPath: value.lessonPath,
    best: value.best,
    last: value.last,
    total: value.total,
    attempts: isNonNegativeInteger(value.attempts) && value.attempts > 0 ? value.attempts : 1,
    lastAt: timestampOr(value.lastAt, 0),
  };
}

/** Newer first by lastAt; ties by key, so the order is stable. */
function newerQuizFirst([keyA, a]: [string, QuizResult], [keyB, b]: [string, QuizResult]): number {
  if (a.lastAt !== b.lastAt) return b.lastAt - a.lastAt;
  return keyA < keyB ? -1 : keyA > keyB ? 1 : 0;
}

/**
 * The quiz results to keep: the newest QUIZ_RESULTS_PER_LESSON_MAX per lesson,
 * then the newest QUIZ_RESULTS_MAX overall. `keepKey` (the result just
 * recorded) is always kept, even when a device clock makes it look older. The
 * kept results stay in their original order; the same object comes back when
 * nothing is dropped.
 */
export function boundQuizResults(quizzes: Record<string, QuizResult>, keepKey?: string): Record<string, QuizResult> {
  const entries = Object.entries(quizzes);
  // No lesson can be over its cap, and nothing is over the total.
  if (entries.length <= QUIZ_RESULTS_PER_LESSON_MAX) return quizzes;
  const ranked = [...entries].sort((a, b) => {
    if (a[0] === keepKey) return -1;
    if (b[0] === keepKey) return 1;
    return newerQuizFirst(a, b);
  });
  const perLesson = new Map<string, number>();
  const kept = new Set<string>();
  for (const [key, result] of ranked) {
    if (kept.size >= QUIZ_RESULTS_MAX) break;
    const count = perLesson.get(result.lessonPath) ?? 0;
    if (count >= QUIZ_RESULTS_PER_LESSON_MAX) continue;
    perLesson.set(result.lessonPath, count + 1);
    kept.add(key);
  }
  if (kept.size === entries.length) return quizzes;
  const bounded: Record<string, QuizResult> = {};
  for (const [key, result] of entries) {
    if (kept.has(key)) bounded[key] = result;
  }
  return bounded;
}

/** Newest first, one per completedAt, at most PLACEMENT_MAX_ATTEMPTS. */
function normalizePlacement(attempts: readonly PlacementAttempt[]): PlacementAttempt[] {
  const seen = new Set<number>();
  return [...attempts]
    .sort((a, b) => b.completedAt - a.completedAt)
    .filter((attempt) => {
      if (seen.has(attempt.completedAt)) return false;
      seen.add(attempt.completedAt);
      return true;
    })
    .slice(0, PLACEMENT_MAX_ATTEMPTS);
}

export function parseAssessmentData(data: unknown): AssessmentData | null {
  if (!isPlainObject(data)) return null;
  const placement = Array.isArray(data.placement)
    ? normalizePlacement(
        data.placement.map(parsePlacementAttempt).filter((attempt): attempt is PlacementAttempt => attempt !== null),
      )
    : [];
  return { placement, quizzes: recordOf(data.quizzes, parseQuizResult) };
}

function mergeQuizResult(local: QuizResult, incoming: QuizResult): QuizResult {
  const latest = incoming.lastAt > local.lastAt ? incoming : local;
  return {
    lessonPath: local.lessonPath,
    best: Math.max(local.best, incoming.best),
    last: latest.last,
    total: latest.total,
    attempts: Math.max(local.attempts, incoming.attempts),
    lastAt: Math.max(local.lastAt, incoming.lastAt),
  };
}

/**
 * Placement attempts are combined (duplicates by completedAt dropped); quiz
 * results keep the best score and the latest attempt, bounded as
 * boundQuizResults says.
 */
export function mergeAssessmentData(local: AssessmentData, incoming: AssessmentData): AssessmentData {
  const quizzes: Record<string, QuizResult> = { ...local.quizzes };
  for (const [key, result] of Object.entries(incoming.quizzes)) {
    const existing = quizzes[key];
    quizzes[key] = existing ? mergeQuizResult(existing, result) : result;
  }
  return { placement: normalizePlacement([...local.placement, ...incoming.placement]), quizzes: boundQuizResults(quizzes) };
}

export const assessmentRecord = defineRecord<AssessmentData>({
  key: ASSESSMENTS_KEY,
  version: 1,
  empty: EMPTY_ASSESSMENTS,
  parse: parseAssessmentData,
  maxChars: ASSESSMENTS_MAX_CHARS,
  merge: mergeAssessmentData,
});

/** Adds a placement attempt (newest first, at most 10 kept). An attempt with an existing completedAt is ignored. */
export function addPlacementAttempt(attempt: PlacementAttempt): WriteOutcome {
  return assessmentRecord.update((data) => {
    if (data.placement.some((existing) => existing.completedAt === attempt.completedAt)) return data;
    return { ...data, placement: normalizePlacement([attempt, ...data.placement]) };
  });
}

/** The newest placement attempt, or null. */
export function latestPlacementAttempt(data: AssessmentData): PlacementAttempt | null {
  return data.placement[0] ?? null;
}

/** 8 hex digits identifying a quiz by its question texts. */
export function quizIdFromQuestions(questionTexts: readonly string[]): string {
  return fnv1a32Hex(questionTexts.join('\n'));
}

export function quizResultKey(lessonPath: string, quizId: string): string {
  return `${lessonPath}#${quizId}`;
}

/**
 * Records one quiz attempt: `correct` of `total` questions. Older results are
 * dropped as boundQuizResults says, so stale results (from quizzes whose
 * questions changed) never stop a new one from being saved. Pass a canonical
 * lesson path (canonicalLessonPath): reads drop a result under any other path.
 */
export function recordQuizResult(
  lessonPath: string,
  quizId: string,
  correct: number,
  total: number,
  now: number = Date.now(),
): WriteOutcome {
  const safeTotal = Math.max(0, Math.trunc(total));
  const safeCorrect = Math.min(safeTotal, Math.max(0, Math.trunc(correct)));
  const key = quizResultKey(lessonPath, quizId);
  return assessmentRecord.update((data) => {
    const existing = data.quizzes[key];
    const result: QuizResult = existing
      ? {
          lessonPath,
          best: Math.max(existing.total === safeTotal ? existing.best : 0, safeCorrect),
          last: safeCorrect,
          total: safeTotal,
          attempts: existing.attempts + 1,
          lastAt: now,
        }
      : { lessonPath, best: safeCorrect, last: safeCorrect, total: safeTotal, attempts: 1, lastAt: now };
    return { ...data, quizzes: boundQuizResults({ ...data.quizzes, [key]: result }, key) };
  });
}
