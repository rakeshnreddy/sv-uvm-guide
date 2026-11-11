/**
 * Where the public header's accent action goes: "Start learning" to the first
 * lesson, or "Continue <code>" to the lesson to continue. The lesson comes from
 * the one continue rule in src/lib/continue-lesson.ts (re-exported here), the
 * same rule the landing page, the curriculum page and the dashboard use. Pure
 * functions, safe on the server and in client islands.
 */
import { CONTINUE_PREFIX, continueLabel } from "@/lib/continue-lesson";

export { resumeLessonHref } from "@/lib/continue-lesson";

/** The accent action before the browser holds a lesson position (and in the server HTML). */
export const START_LEARNING_LABEL = "Start learning";

/** The first word of the accent action once the browser holds a lesson position ("Continue F3C"). */
export const CONTINUE_LABEL = CONTINUE_PREFIX;

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
 * The longest continue label any lesson can produce. The header reserves its
 * width (an invisible copy in the same grid cell), so the row never moves
 * when the stored position appears after hydration, whatever the module code.
 */
export function longestContinueLabel(lessons: readonly { code: string }[]): string {
  return lessons.reduce((longest, lesson) => {
    const label = continueLabel(lesson);
    return label.length > longest.length ? label : longest;
  }, CONTINUE_PREFIX);
}

/** The module code of that longest label, for the header's invisible sizer (shown as a signal tag). */
export function longestContinueCode(lessons: readonly { code: string }[]): string {
  return lessons.reduce((longest, lesson) => (lesson.code.length > longest.length ? lesson.code : longest), "");
}
