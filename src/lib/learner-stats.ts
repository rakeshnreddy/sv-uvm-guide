/**
 * Pure helpers that turn the learner records kept in this browser into the
 * numbers the dashboard shows: lessons opened and done per tier and module,
 * the daily streak and the last 7 days, quizzes under 75% on lessons that
 * still exist, labs in progress
 * or done, exercise best scores and the backup reminder.
 *
 * Nothing here reads storage, the clock or the curriculum data on its own:
 * callers pass every input in (including `now`), so the helpers are safe in
 * server components and easy to test. Days are local calendar days
 * ('YYYY-MM-DD' from localDayKey), so a streak follows the learner's own
 * midnight and survives daylight-saving changes.
 */
import type { Module as CurriculumTier } from '@/lib/curriculum-data';
import { cleanLessonTitle, lessonHref, moduleCode, tierNumber } from '@/lib/curriculum-overview';
import type { ActivityCounts } from '@/lib/learner-store/repositories/activity';
import type { AssessmentData, QuizResult } from '@/lib/learner-store/repositories/assessments';
import type { FlashcardData } from '@/lib/learner-store/repositories/flashcards';
import type { LabProgressRecord } from '@/lib/learner-store/repositories/labs';
import type { StoredExerciseProgress } from '@/lib/learner-store/repositories/legacy';
import type { CurriculumProgressData, LessonLogData } from '@/lib/learner-store/repositories/lessons';
import type { LearnerMeta } from '@/lib/learner-store/repositories/meta';
import type { NotebookEntry } from '@/lib/learner-store/repositories/notebook';
import { DAY_MS, dayKeyToMs, localDayKey } from '@/lib/learner-store/time';

// ---------------------------------------------------------------------------
// Static curriculum totals (built on the server, passed to the dashboard)
// ---------------------------------------------------------------------------

export interface StaticLesson {
  slug: string;
  title: string;
  /** Canonical lesson path, '/curriculum/<Tier>/<Module>/<lesson>'. */
  href: string;
}

export interface StaticModule {
  /** The module folder (section slug), the key 'curriculumProgress' uses. */
  id: string;
  code: string;
  title: string;
  tierId: string;
  lessons: StaticLesson[];
}

export interface StaticTier {
  /** The tier folder, for example 'T1_Foundational'. */
  id: string;
  number: number;
  /** 'Tier 1: Foundational'. */
  label: string;
  modules: StaticModule[];
}

/** Every tier, module and lesson in curriculum order: the dashboard's lesson totals. */
export function buildCurriculumTotals(data: readonly CurriculumTier[]): StaticTier[] {
  return data.map((tier) => {
    const number = tierNumber(tier.slug);
    return {
      id: tier.slug,
      number,
      label: number > 0 ? `Tier ${number}: ${tier.title}` : tier.title,
      modules: tier.sections.map((section) => ({
        id: section.slug,
        code: moduleCode(section.slug),
        title: cleanLessonTitle(section.title),
        tierId: tier.slug,
        lessons: section.topics.map((topic) => ({
          slug: topic.slug,
          title: cleanLessonTitle(topic.title),
          href: lessonHref(tier.slug, section.slug, topic.slug),
        })),
      })),
    };
  });
}

export interface IndexedStaticLesson extends StaticLesson {
  moduleId: string;
  moduleCode: string;
  moduleTitle: string;
  tierId: string;
}

/** Lessons by canonical path. */
export function indexStaticLessons(tiers: readonly StaticTier[]): Map<string, IndexedStaticLesson> {
  const index = new Map<string, IndexedStaticLesson>();
  for (const tier of tiers) {
    for (const mod of tier.modules) {
      for (const lesson of mod.lessons) {
        index.set(lesson.href, {
          ...lesson,
          moduleId: mod.id,
          moduleCode: mod.code,
          moduleTitle: mod.title,
          tierId: tier.id,
        });
      }
    }
  }
  return index;
}

// ---------------------------------------------------------------------------
// Lessons opened and done, per tier and module
// ---------------------------------------------------------------------------

export interface LessonCounts {
  /** Lessons in the curriculum. */
  total: number;
  /** Lessons opened in this browser (done lessons count as opened). */
  opened: number;
  /** Lessons marked done. */
  done: number;
  /** done / total, as a whole percentage. */
  percentDone: number;
}

export interface ModuleProgressSummary extends LessonCounts {
  id: string;
  code: string;
  title: string;
  tierId: string;
}

export interface TierProgressSummary extends LessonCounts {
  id: string;
  number: number;
  label: string;
  modules: ModuleProgressSummary[];
}

export interface CurriculumProgressSummary extends LessonCounts {
  tiers: TierProgressSummary[];
}

function percent(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

function counts(total: number, opened: number, done: number): LessonCounts {
  return { total, opened, done, percentDone: percent(done, total) };
}

/**
 * Lessons opened and done per tier and module. A lesson counts as opened when
 * the lesson log has it, when it is its module's last opened lesson in
 * 'curriculumProgress' (visits saved before the lesson log existed), or when
 * it is marked done. Done lessons that are no longer in the curriculum, and
 * log entries for unknown paths, are ignored. Tier and overall percentages
 * are lesson-weighted.
 */
export function tierAndModuleProgress(
  tiers: readonly StaticTier[],
  progress: CurriculumProgressData,
  lessonLog: LessonLogData,
): CurriculumProgressSummary {
  let total = 0;
  let opened = 0;
  let done = 0;
  const tierSummaries = tiers.map((tier) => {
    let tierTotal = 0;
    let tierOpened = 0;
    let tierDone = 0;
    const modules = tier.modules.map((mod) => {
      const entry = progress[mod.id];
      const completed = new Set(entry?.completedLessons ?? []);
      const lastOpened = entry?.lastVisitedAt ? (entry.lastVisitedLesson ?? 'index') : null;
      let moduleOpened = 0;
      let moduleDone = 0;
      for (const lesson of mod.lessons) {
        const isDone = completed.has(lesson.slug);
        if (isDone) moduleDone += 1;
        if (isDone || lessonLog.lessons[lesson.href] !== undefined || lastOpened === lesson.slug) moduleOpened += 1;
      }
      tierTotal += mod.lessons.length;
      tierOpened += moduleOpened;
      tierDone += moduleDone;
      return {
        id: mod.id,
        code: mod.code,
        title: mod.title,
        tierId: tier.id,
        ...counts(mod.lessons.length, moduleOpened, moduleDone),
      };
    });
    total += tierTotal;
    opened += tierOpened;
    done += tierDone;
    return { id: tier.id, number: tier.number, label: tier.label, modules, ...counts(tierTotal, tierOpened, tierDone) };
  });
  return { tiers: tierSummaries, ...counts(total, opened, done) };
}

// ---------------------------------------------------------------------------
// Activity: the daily streak and the last 7 days
// ---------------------------------------------------------------------------

export type ActivityDays = Readonly<Record<string, ActivityCounts | undefined>>;

/** The sum of a day's activity counts. */
export function activityTotal(counts: ActivityCounts | undefined): number {
  if (!counts) return 0;
  return Object.values(counts).reduce<number>((sum, value) => sum + (value ?? 0), 0);
}

/** The local day key before `key`, computed at local noon so daylight-saving changes never skip or repeat a day. */
function previousDayKey(key: string): string {
  const midnight = dayKeyToMs(key);
  if (midnight === null) return key;
  const date = new Date(midnight);
  return localDayKey(new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1, 12).getTime());
}

/**
 * Active local days in a row, ending today. A learner who has done nothing yet
 * today keeps yesterday's streak until the day is over; a day with no activity
 * breaks it.
 */
export function dailyStreak(days: ActivityDays, now: number): number {
  let cursor = localDayKey(now);
  if (activityTotal(days[cursor]) === 0) cursor = previousDayKey(cursor);
  let streak = 0;
  // A day key is a calendar date, so at most one entry per day can match; the bound only guards bad input.
  while (activityTotal(days[cursor]) > 0 && streak <= 4_000) {
    streak += 1;
    cursor = previousDayKey(cursor);
  }
  return streak;
}

export interface ActivityDay {
  /** 'YYYY-MM-DD', local. */
  dayKey: string;
  total: number;
  counts: ActivityCounts;
}

/** The last 7 local days, oldest first, ending today. */
export function last7Days(days: ActivityDays, now: number): ActivityDay[] {
  const keys = [localDayKey(now)];
  while (keys.length < 7) keys.unshift(previousDayKey(keys[0]));
  return keys.map((dayKey) => {
    const dayCounts = days[dayKey] ?? {};
    return { dayKey, total: activityTotal(dayCounts), counts: { ...dayCounts } };
  });
}

// ---------------------------------------------------------------------------
// Lesson quizzes
// ---------------------------------------------------------------------------

export const WEAK_QUIZ_THRESHOLD = 0.75;

export interface QuizScore extends QuizResult {
  /** `${lessonPath}#${quizId}`. */
  key: string;
  /** best / total, from 0 to 1. */
  bestFraction: number;
}

export interface WeakQuizLesson {
  lessonPath: string;
  /** The lesson's quizzes whose best score is under the threshold, lowest first. */
  quizzes: QuizScore[];
  /** The lowest best score among them, from 0 to 1. */
  lowestFraction: number;
  /** Epoch ms of the latest attempt among them. */
  lastAt: number;
}

/**
 * The quiz results whose lessonPath is a lesson in `lessons` (for example the
 * indexStaticLessons map). Results for removed lessons, or for paths that are
 * not lessons at all (an edited backup can hold any string), are dropped, so
 * a stored path never becomes a link.
 */
export function quizzesOnKnownLessons(
  quizzes: Readonly<Record<string, QuizResult>>,
  lessons: { has(lessonPath: string): boolean },
): Record<string, QuizResult> {
  const known: Record<string, QuizResult> = {};
  for (const [key, result] of Object.entries(quizzes)) {
    if (lessons.has(result.lessonPath)) known[key] = result;
  }
  return known;
}

/**
 * Lessons with a quiz whose best score is under `threshold` (75% by default),
 * grouped by lesson path, lowest score first. Quizzes with no questions are
 * ignored. Pass the output of quizzesOnKnownLessons before linking a lesson.
 */
export function weakQuizLessons(
  quizzes: Readonly<Record<string, QuizResult>>,
  threshold: number = WEAK_QUIZ_THRESHOLD,
): WeakQuizLesson[] {
  const byLesson = new Map<string, QuizScore[]>();
  for (const [key, result] of Object.entries(quizzes)) {
    if (result.total <= 0) continue;
    const bestFraction = result.best / result.total;
    if (bestFraction >= threshold) continue;
    const list = byLesson.get(result.lessonPath) ?? [];
    list.push({ ...result, key, bestFraction });
    byLesson.set(result.lessonPath, list);
  }
  return [...byLesson.entries()]
    .map(([lessonPath, list]) => {
      const sorted = [...list].sort((a, b) => a.bestFraction - b.bestFraction || b.lastAt - a.lastAt);
      return {
        lessonPath,
        quizzes: sorted,
        lowestFraction: sorted[0].bestFraction,
        lastAt: Math.max(...sorted.map((quiz) => quiz.lastAt)),
      };
    })
    .sort((a, b) => a.lowestFraction - b.lowestFraction || b.lastAt - a.lastAt || (a.lessonPath < b.lessonPath ? -1 : 1));
}

// ---------------------------------------------------------------------------
// Labs
// ---------------------------------------------------------------------------

/** What the dashboard knows about an available lab, from the registry on the server. */
export interface LabMeta {
  id: string;
  version: string;
  title: string;
  stepCount: number;
  href: string;
}

export interface LabSummary {
  id: string;
  title: string;
  href: string;
  status: 'in_progress' | 'completed';
  /** Steps marked complete, at most stepCount. */
  completedSteps: number;
  stepCount: number;
  /** Epoch ms of the record's last change. */
  updatedAt: number;
  completedAt?: number;
  /** False when the saved record belongs to an earlier version of the lab. */
  currentVersion: boolean;
}

export interface LabSummaries {
  /** Newest change first. */
  inProgress: LabSummary[];
  /** Newest completion first. */
  completed: LabSummary[];
}

/**
 * One summary per available lab with a saved record: the record for the
 * current version when there is one, otherwise the newest earlier version.
 * Records for labs that are not available are ignored.
 */
export function labSummaries(records: readonly LabProgressRecord[], labs: readonly LabMeta[]): LabSummaries {
  const inProgress: LabSummary[] = [];
  const completed: LabSummary[] = [];
  for (const lab of labs) {
    const saved = records.filter((record) => record.labId === lab.id);
    if (saved.length === 0) continue;
    const current = saved.find((record) => record.labVersion === lab.version);
    const record = current ?? [...saved].sort((a, b) => b.updatedAt - a.updatedAt)[0];
    const summary: LabSummary = {
      id: lab.id,
      title: lab.title,
      href: lab.href,
      status: record.status,
      completedSteps: Math.min(record.completedSteps.length, lab.stepCount),
      stepCount: lab.stepCount,
      updatedAt: record.updatedAt,
      currentVersion: current !== undefined,
    };
    if (record.completedAt !== undefined) summary.completedAt = record.completedAt;
    (summary.status === 'completed' ? completed : inProgress).push(summary);
  }
  inProgress.sort((a, b) => b.updatedAt - a.updatedAt);
  completed.sort((a, b) => (b.completedAt ?? b.updatedAt) - (a.completedAt ?? a.updatedAt));
  return { inProgress, completed };
}

// ---------------------------------------------------------------------------
// Exercises
// ---------------------------------------------------------------------------

export interface ExerciseMeta {
  /** The id useExerciseProgress stores under ('sv-uvm-guide:exercise:<id>'). */
  id: string;
  title: string;
  href: string;
}

export interface ExerciseSummary {
  id: string;
  title: string;
  href?: string;
  /** Best score, a whole percentage from 0 to 100. */
  bestScore: number;
  attempts: number;
  /** ISO time of the last attempt. */
  lastPlayed?: string;
}

/** Exercises attempted at least once, most recently played first; unknown ids keep their id as the title. */
export function exerciseSummaries(
  entries: readonly StoredExerciseProgress[],
  exercises: readonly ExerciseMeta[] = [],
): ExerciseSummary[] {
  const meta = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  return entries
    .filter((entry) => entry.progress.attempts > 0)
    .map((entry) => {
      const known = meta.get(entry.exerciseId);
      const summary: ExerciseSummary = {
        id: entry.exerciseId,
        title: known?.title ?? entry.exerciseId,
        bestScore: Math.round(Math.min(100, Math.max(0, entry.progress.bestScore))),
        attempts: entry.progress.attempts,
      };
      if (known) summary.href = known.href;
      if (entry.progress.lastPlayed) summary.lastPlayed = entry.progress.lastPlayed;
      return summary;
    })
    .sort((a, b) => (Date.parse(b.lastPlayed ?? '') || 0) - (Date.parse(a.lastPlayed ?? '') || 0) || (a.id < b.id ? -1 : 1));
}

// ---------------------------------------------------------------------------
// Flashcards
// ---------------------------------------------------------------------------

/** Cards with review state that are still in their deck's current card list. */
export function trackedCardCount(data: FlashcardData): number {
  let tracked = 0;
  for (const [cardId, state] of Object.entries(data.cards)) {
    if (data.decks[state.deckId]?.cardIds.includes(cardId)) tracked += 1;
  }
  return tracked;
}

// ---------------------------------------------------------------------------
// Whether anything is recorded, and the backup reminder
// ---------------------------------------------------------------------------

export interface LearnerDataSnapshot {
  curriculum: CurriculumProgressData;
  lessonLog: LessonLogData;
  labs: readonly LabProgressRecord[];
  flashcards: FlashcardData;
  notebook: readonly NotebookEntry[];
  assessments: AssessmentData;
  activity: ActivityDays;
  exercises: readonly StoredExerciseProgress[];
}

/** True when this browser holds any learner record worth showing (a chosen route alone does not count). */
export function hasLearnerData(snapshot: LearnerDataSnapshot): boolean {
  const curriculum = Object.values(snapshot.curriculum).some(
    (entry) => Boolean(entry?.lastVisitedAt) || (entry?.completedLessons.length ?? 0) > 0,
  );
  return (
    curriculum ||
    Object.keys(snapshot.lessonLog.lessons).length > 0 ||
    snapshot.labs.length > 0 ||
    Object.keys(snapshot.flashcards.cards).length > 0 ||
    snapshot.notebook.length > 0 ||
    snapshot.assessments.placement.length > 0 ||
    Object.keys(snapshot.assessments.quizzes).length > 0 ||
    Object.values(snapshot.activity).some((day) => activityTotal(day) > 0) ||
    snapshot.exercises.some((entry) => entry.progress.attempts > 0)
  );
}

export const BACKUP_REMINDER_DAYS = 14;

/**
 * True when there is learner data and no backup was downloaded in the last
 * 14 days (or ever). Some browsers delete site data for sites a person has
 * not visited for a while, so the dashboard reminds the learner to export.
 */
export function backupReminder(meta: Pick<LearnerMeta, 'lastExportAt'>, hasData: boolean, now: number): boolean {
  if (!hasData) return false;
  const lastExportAt = meta.lastExportAt;
  if (lastExportAt === undefined || lastExportAt <= 0) return true;
  return now - lastExportAt > BACKUP_REMINDER_DAYS * DAY_MS;
}
