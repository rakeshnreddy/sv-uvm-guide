/**
 * The landing page's "coming back" pieces (DESIGN.md section 10). The continue
 * rule itself, and the labels that name its lesson, live in
 * src/lib/continue-lesson.ts, shared with the public header, the curriculum
 * page and the dashboard; they are re-exported here for the landing islands.
 * What stays here is landing-only: the label before a position exists and the
 * inline script that reserves the returning-learner strip's space.
 */
import type { ContinueLessonEntry } from '@/lib/continue-lesson';
import { CURRICULUM_PROGRESS_KEY, LESSONS_KEY } from '@/lib/learner-store/keys';

export {
  continueAccessibleName,
  continueLabel,
  continueLesson,
  hasLessonPosition,
  isLessonDone,
  lastOpenedAt,
  resumeLesson,
  type ContinuePosition,
  type ContinueReason,
} from '@/lib/continue-lesson';

/** One lesson as the landing islands need it (the shared continue entry). */
export type LandingLesson = ContinueLessonEntry;

/** The hero's primary action before this browser holds a lesson position (and in the server HTML). */
export const START_LESSON_LABEL = 'Start lesson 1';

/** Set on <html> by the inline script when the browser holds a lesson visit. */
export const RETURNING_ATTRIBUTE = 'data-home-returning';

/**
 * A tiny blocking script, run while the HTML is parsed (before first paint):
 * it reads the two lesson records straight from localStorage and marks <html>
 * when either holds a visit, so the returning-learner strip's box is shown at
 * its final size before React hydrates and nothing below it moves. It never
 * writes storage and fails silently where storage is blocked.
 */
export function returningLearnerScript(): string {
  const keys = JSON.stringify({ log: LESSONS_KEY, legacy: CURRICULUM_PROGRESS_KEY });
  return `(function(){try{var k=${keys},s=window.localStorage,a=JSON.parse(s.getItem(k.log)||"null"),b=JSON.parse(s.getItem(k.legacy)||"null"),l=a&&a.data&&a.data.lessons,h=!!(l&&typeof l==="object"&&Object.keys(l).length)||!!(b&&typeof b==="object"&&Object.keys(b).some(function(m){return b[m]&&b[m].lastVisitedAt}));if(h)document.documentElement.setAttribute(${JSON.stringify(RETURNING_ATTRIBUTE)},"")}catch(e){}})();`;
}
