/**
 * The lesson list every "Continue" surface resolves against (see
 * src/lib/continue-lesson.ts), built once on the server from the curriculum
 * data: every lesson in course order with its module code, its title (as the
 * lesson pages and the practice links name it) and the next lesson on the
 * learning path. One builder, so the landing page, the public header, the
 * curriculum page and the dashboard name the same lesson the same way.
 *
 * Server only: it reads the full curriculum data. Pass the result to client
 * islands as a prop.
 */
import { findPrevNextTopics } from '@/lib/curriculum-data';
import type { ContinueLessonEntry } from '@/lib/continue-lesson';
import { allLessons } from '@/lib/practice-links';

let cache: ContinueLessonEntry[] | null = null;

/** One lesson with the next lesson on the learning path (the one the lesson page links to). */
export function continueLessonEntry({ href, code, title }: { href: string; code: string; title: string }): ContinueLessonEntry {
  const next = findPrevNextTopics(href.replace(/^\/curriculum\//, '').split('/')).next;
  return next ? { href, code, title, nextHref: `/curriculum/${next.slug}` } : { href, code, title };
}

/** Every lesson in course order, for continueLesson. */
export function continueLessons(): ContinueLessonEntry[] {
  cache ??= allLessons().map(continueLessonEntry);
  return cache;
}
