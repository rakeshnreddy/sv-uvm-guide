/**
 * The curriculum index's third "before first paint" mark: how many lessons
 * "Recently visited" will list (0 to 3), so the box under "Continue the
 * course" paints at its final height on a phone instead of keeping room for
 * three rows, and whether the lesson to continue follows one marked done
 * (RESUME_DONE_ATTRIBUTE: its reason note is two lines, not one). Set on
 * <html> as RECENT_COUNT_ATTRIBUTE by an inline script that
 * reads the two lesson records straight from localStorage and applies, in
 * ES5, the same rules the page applies after hydration:
 *
 * - the lesson to continue (continueLesson in src/lib/continue-lesson.ts): the
 *   newest visit in the lesson log or the legacy per-module record, or the next
 *   lesson on the learning path when that one is marked done;
 * - the recent list (Recommendations): the four newest per-module visits,
 *   without lessons the index does not have and without the lesson to
 *   continue, at most three.
 *
 * A unit test runs the script against the component's own functions on many
 * stored states. It never writes storage and fails silently where storage is
 * blocked (then the attribute is absent and the box keeps room for three).
 */
import type { ContinueLessonEntry } from '@/lib/continue-lesson';
import { CURRICULUM_PROGRESS_KEY, LESSONS_KEY } from '@/lib/learner-store/keys';

/** Set on <html>: "0" to "3", the number of lessons "Recently visited" will list. */
export const RECENT_COUNT_ATTRIBUTE = 'data-resume-recent';

/** Set on <html> when the lesson to continue is the one after a lesson marked done (its reason note runs to two lines). */
export const RESUME_DONE_ATTRIBUTE = 'data-resume-done';

/** At most this many recent lessons are listed (recentLessonsToList's default). */
export const RECENT_LIMIT = 3;

/** The lessons as the script needs them: "<module>/<lesson>" keys in course order, and where `next` is not simply the following key. */
export interface RecentScriptLessons {
  keys: string[];
  /** Index of the next lesson for the lessons whose next is not keys[i + 1]; -1 for none. */
  next: Record<number, number>;
}

/** "/curriculum/T1_Foundational/F2D_Reusable_Code_and_Parallelism/ipc" -> "F2D_Reusable_Code_and_Parallelism/ipc". */
export function lessonKeyOfHref(href: string): string {
  return href.split('/').slice(-2).join('/');
}

/** The compact lesson table the script carries: a few kilobytes for the whole course. */
export function recentScriptLessons(lessons: readonly Pick<ContinueLessonEntry, 'href' | 'nextHref'>[]): RecentScriptLessons {
  const index = new Map(lessons.map((lesson, i) => [lesson.href, i]));
  const next: Record<number, number> = {};
  lessons.forEach((lesson, i) => {
    const target = lesson.nextHref ? (index.get(lesson.nextHref) ?? -1) : -1;
    if (target !== i + 1) next[i] = target;
  });
  return { keys: lessons.map((lesson) => lessonKeyOfHref(lesson.href)), next };
}

/**
 * The script. `lessons` is recentScriptLessons(continueLessons()). Every value
 * it embeds goes through JSON.stringify; "<" is escaped so no lesson key can
 * close the script element.
 */
export function resumeRecentScript(lessons: RecentScriptLessons): string {
  const data = JSON.stringify({
    k: lessons.keys,
    n: lessons.next,
    log: LESSONS_KEY,
    legacy: CURRICULUM_PROGRESS_KEY,
    attr: RECENT_COUNT_ATTRIBUTE,
    done: RESUME_DONE_ATTRIBUTE,
    max: RECENT_LIMIT,
  }).replace(/</g, '\\u003c');
  return (
    `(function(){try{var d=${data},s=window.localStorage,i,x,k,t,best=null,idx={};` +
    `for(i=0;i<d.k.length;i++)idx[d.k[i]]=i;` +
    `var a=JSON.parse(s.getItem(d.log)||"null"),l=(a&&a.data&&a.data.lessons)||{},p=JSON.parse(s.getItem(d.legacy)||"null")||{};` +
    `if(typeof p!=="object")p={};` +
    // The lesson opened last: the lesson log first, then newer legacy visits (resumeLessonHref).
    `for(x in l){t=l[x]&&l[x].lastVisitedAt;if(typeof t!=="number"||x.indexOf("/curriculum/")!==0)continue;k=x.split("/").slice(-2).join("/");if(idx.hasOwnProperty(k)&&(!best||t>best.t))best={k:k,t:t}}` +
    `for(x in p){t=p[x]&&p[x].lastVisitedAt;if(!t||(best&&t<=best.t))continue;k=x+"/"+(p[x].lastVisitedLesson||"index");if(idx.hasOwnProperty(k))best={k:k,t:t}}` +
    // Done: continue with the next lesson on the learning path (continueLesson).
    `var c=best&&best.k;if(c){var m=c.split("/"),e=p[m[0]],j=idx[c],n=d.n.hasOwnProperty(j)?d.n[j]:j+1;` +
    `if(e&&e.completedLessons&&e.completedLessons.indexOf(m[1])>=0&&n>=0&&n<d.k.length){c=d.k[n];document.documentElement.setAttribute(d.done,"")}}` +
    // The four newest per-module visits (recentVisits), known lessons only, without the lesson to continue, at most three.
    `var v=[];for(x in p){if(p[x]&&p[x].lastVisitedAt)v.push({k:x+"/"+(p[x].lastVisitedLesson||"index"),t:p[x].lastVisitedAt})}` +
    `v.sort(function(f,g){return g.t-f.t});var r=0;` +
    `for(i=0;i<v.length&&i<4;i++){if(idx.hasOwnProperty(v[i].k)&&v[i].k!==c)r++}` +
    `document.documentElement.setAttribute(d.attr,String(Math.min(r,d.max)))}catch(err){}})();`
  );
}
