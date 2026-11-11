/**
 * The one "continue" rule (DESIGN.md section 10), shared by every surface that
 * offers a returning learner "Continue": the landing hero and its
 * returning-learner strip, the public header's accent action, the curriculum
 * page's "Pick up where you left off" and the dashboard's Continue card.
 *
 * The rule: the lesson this browser opened last, unless it is marked done, in
 * which case the lesson after it on the learning path (the next lesson the
 * lesson page itself links to). The final lesson, done, stays the lesson to
 * continue. A stored lesson that no longer exists is ignored.
 *
 * Pure functions over plain data (no React, no storage access), so the rule is
 * unit-tested without a browser and every surface resolves the same lesson
 * from the same records. The list of lessons comes from one server-side
 * builder, continueLessons() in src/lib/continue-lesson-data.ts, so every
 * surface also names the lesson the same way.
 */
import type { CurriculumProgressData, LessonLogData } from '@/lib/learner-store/repositories/lessons';

/** One lesson as the rule needs it: plain data, small enough to send to the browser. */
export interface ContinueLessonEntry {
  /** Canonical lesson path, '/curriculum/<Tier>/<Module>/<lesson>'. */
  href: string;
  /** Module code, for example F3C. */
  code: string;
  title: string;
  /** The next lesson on the learning path (findPrevNextTopics), absent for the last one. */
  nextHref?: string;
}

/** The two records the rule reads, as the learner store holds them. */
export type LessonLogLike = Pick<LessonLogData, 'lessons'>;
export type ProgressRecordLike = Readonly<CurriculumProgressData>;

/** Why a lesson is the one to continue. */
export type ContinueReason = 'last-opened' | 'next-after-done';

export interface ContinuePosition<L extends ContinueLessonEntry = ContinueLessonEntry> {
  /** The lesson to continue. */
  lesson: L;
  /** The lesson this browser opened last (the same as `lesson` unless it is done). */
  lastOpened: L;
  reason: ContinueReason;
}

/** The first word of every continue label. */
export const CONTINUE_PREFIX = 'Continue';

/**
 * The visible label of a continue action: the module code only, so it fits a
 * fixed-width button ("Continue F3C"). Where there is room a surface follows
 * it with ": <title>", which is exactly the accessible name below.
 */
export function continueLabel(lesson: Pick<ContinueLessonEntry, 'code'>): string {
  return `${CONTINUE_PREFIX} ${lesson.code}`;
}

/** The accessible name of a continue action: the visible label, then the lesson's full title. */
export function continueAccessibleName(lesson: Pick<ContinueLessonEntry, 'code' | 'title'>): string {
  return `${continueLabel(lesson)}: ${lesson.title}`;
}

/**
 * The most recently opened lesson that still exists, as its path, or null when
 * the browser holds no lesson position. Reads the lesson log (keyed by
 * canonical path) and, for visits saved before the log existed, the legacy
 * 'curriculumProgress' record, which keeps the last lesson per module.
 */
export function resumeLessonHref(
  lessonLog: LessonLogLike,
  progress: ProgressRecordLike,
  lessonPaths: readonly string[],
): string | null {
  const known = new Set(lessonPaths);
  let best: { href: string; at: number } | null = null;

  for (const [path, visit] of Object.entries(lessonLog.lessons)) {
    if (known.has(path) && (!best || visit.lastVisitedAt > best.at)) best = { href: path, at: visit.lastVisitedAt };
  }

  // Not lastVisit() from src/lib/learning-route-state.ts: that keeps only the
  // newest legacy entry, so a newest entry whose lesson is gone would hide an
  // older legacy lesson that still exists. This scan skips the gone one.
  for (const [moduleId, entry] of Object.entries(progress)) {
    if (!entry?.lastVisitedAt || (best && entry.lastVisitedAt <= best.at)) continue;
    const suffix = `/${moduleId}/${entry.lastVisitedLesson ?? 'index'}`;
    const href = lessonPaths.find((path) => path.endsWith(suffix));
    if (href) best = { href, at: entry.lastVisitedAt };
  }

  return best?.href ?? null;
}

/** The lesson this browser opened last, or null when it holds no position on a lesson that still exists. */
export function resumeLesson<L extends ContinueLessonEntry>(
  lessonLog: LessonLogLike,
  progress: ProgressRecordLike,
  lessons: readonly L[],
): L | null {
  const href = resumeLessonHref(
    lessonLog,
    progress,
    lessons.map((lesson) => lesson.href),
  );
  return href ? (lessons.find((lesson) => lesson.href === href) ?? null) : null;
}

/** True when the lesson at `href` ('/curriculum/<Tier>/<Module>/<lesson>') is marked done in this browser. */
export function isLessonDone(progress: ProgressRecordLike, href: string): boolean {
  const [moduleId, slug] = href.split('/').slice(-2);
  return Boolean(moduleId && slug && progress[moduleId]?.completedLessons.includes(slug));
}

/**
 * The lesson to continue: the one opened last, or, when that one is marked
 * done, the next lesson on the learning path. The final lesson, done, stays
 * the lesson to continue. Null when the browser holds no position on a lesson
 * that still exists.
 */
export function continueLesson<L extends ContinueLessonEntry>(
  lessonLog: LessonLogLike,
  progress: ProgressRecordLike,
  lessons: readonly L[],
): ContinuePosition<L> | null {
  const lastOpened = resumeLesson(lessonLog, progress, lessons);
  if (!lastOpened) return null;
  if (isLessonDone(progress, lastOpened.href) && lastOpened.nextHref) {
    const next = lessons.find((lesson) => lesson.href === lastOpened.nextHref);
    if (next) return { lesson: next, lastOpened, reason: 'next-after-done' };
  }
  return { lesson: lastOpened, lastOpened, reason: 'last-opened' };
}

/** When this browser last opened the lesson at `href`, from either record (epoch ms), or null. */
export function lastOpenedAt(lessonLog: LessonLogLike, progress: ProgressRecordLike, href: string): number | null {
  let latest = lessonLog.lessons[href]?.lastVisitedAt ?? 0;
  for (const [moduleId, entry] of Object.entries(progress)) {
    if (entry?.lastVisitedAt && href.endsWith(`/${moduleId}/${entry.lastVisitedLesson ?? 'index'}`)) {
      latest = Math.max(latest, entry.lastVisitedAt);
    }
  }
  return latest || null;
}

/** True when the browser holds any lesson visit, in either record. */
export function hasLessonPosition(lessonLog: LessonLogLike, progress: ProgressRecordLike): boolean {
  return Object.keys(lessonLog.lessons).length > 0 || Object.values(progress).some((entry) => Boolean(entry?.lastVisitedAt));
}
