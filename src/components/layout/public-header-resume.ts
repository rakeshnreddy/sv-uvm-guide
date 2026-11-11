/**
 * Where the public header's accent action goes: "Start learning" to the first
 * lesson, or "Continue" to the lesson this browser opened last. Pure functions,
 * safe on the server and in client islands, so the choice is unit-tested
 * without a browser.
 *
 * The last opened lesson comes from the same two records the dashboard reads
 * (DashboardPageClient's latestLesson): the lesson log, keyed by canonical
 * lesson path, and, for visits saved before the log existed, the legacy
 * 'curriculumProgress' record, which keeps the last lesson per module. A
 * stored lesson that no longer exists is ignored.
 */
import type { CurriculumProgressData, LessonLogData } from "@/lib/learner-store/repositories/lessons";

/** The accent action before the browser holds a lesson position (and in the server HTML). */
export const START_LEARNING_LABEL = "Start learning";

/** The accent action once the browser holds a lesson position. */
export const CONTINUE_LABEL = "Continue";

/** The parts of content/curriculum/curriculum.manifest.json this reads. */
export interface LessonManifest {
  tiers: readonly { id: string; modules: readonly { id: string; lessons: readonly string[] }[] }[];
}

/**
 * Every lesson's path, in course order: '/curriculum/<Tier>/<Module>/<lesson>'.
 * A module's index page comes first, as moduleHref in curriculum-data does.
 */
export function lessonPathsFromManifest(manifest: LessonManifest): string[] {
  return manifest.tiers.flatMap((tier) =>
    tier.modules.flatMap((module) => {
      const lessons = module.lessons.includes("index")
        ? ["index", ...module.lessons.filter((lesson) => lesson !== "index")]
        : [...module.lessons];
      return lessons.map((lesson) => `/curriculum/${tier.id}/${module.id}/${lesson}`);
    }),
  );
}

/**
 * The most recently opened lesson that still exists, as its path, or null when
 * the browser holds no lesson position.
 */
export function resumeLessonHref(
  lessonLog: Pick<LessonLogData, "lessons">,
  progress: Readonly<CurriculumProgressData>,
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
    const suffix = `/${moduleId}/${entry.lastVisitedLesson ?? "index"}`;
    const href = lessonPaths.find((path) => path.endsWith(suffix));
    if (href) best = { href, at: entry.lastVisitedAt };
  }

  return best?.href ?? null;
}
