/**
 * The next lesson on each learning route, for one lesson page (closure
 * finding C10).
 *
 * The lesson page's Next and Previous links follow the core path in manifest
 * order (docs/curriculum-quality/plan.md section 1.1). The routes in
 * src/lib/learning-paths.ts take a subset of the core path, so at some step
 * boundaries the core Next and Previous leave the route. This module works
 * out, on the server, where each route goes after and before this lesson,
 * including a lesson a route names only as a practice link (the Expert
 * route's B-AMBA-F3 clinic) and route steps that have practice but no
 * lessons (the Expert route's interview step). The page hands the result
 * to RouteNextLink, a client component that shows the entry for the route the
 * learner follows (chosen in this browser) and nothing otherwise.
 *
 * Server-side and test-side only: it reads the generated curriculum data.
 */
import { curriculumData } from "@/lib/curriculum-data";
import { lessonHref, lessonKey } from "@/lib/curriculum-overview";
import { resolveRoutes, type ResolvedLesson, type ResolvedRoute } from "@/lib/learning-paths";
import type { RouteLessonLink, RouteNextOption } from "@/lib/learning-route-state";

import { getLessonRef } from "./lesson-context";

let cachedRoutes: ResolvedRoute[] | undefined;

/** The routes resolved once per process: lesson order only, so no lab registry is needed. */
function routes(): ResolvedRoute[] {
  cachedRoutes ??= resolveRoutes(curriculumData);
  return cachedRoutes;
}

function stepLabel(route: ResolvedRoute, stepIndex: number): string {
  return `Step ${stepIndex + 1} of ${route.steps.length}: ${route.steps[stepIndex]?.title ?? ""}`.trim();
}

function lessonLink(route: ResolvedRoute, lesson: ResolvedLesson): RouteLessonLink {
  const ref = getLessonRef(lesson.href.split("/").slice(2));
  return { href: lesson.href, label: ref?.label ?? lesson.title, step: stepLabel(route, lesson.stepIndex) };
}

/**
 * Where this lesson sits on a route: its index in the route's sequence, or,
 * for a lesson the route names only as an in-lesson practice link (the Expert
 * route's interview step names the B-AMBA-F3 clinic this way), the step that
 * names it. Undefined when the route does not take the lesson.
 */
function placeOnRoute(route: ResolvedRoute, key: string, href: string | undefined): { index: number } | { stepIndex: number } | undefined {
  const index = route.sequence.findIndex((lesson) => lesson.key === key);
  if (index !== -1) return { index };
  if (!href) return undefined;
  const stepIndex = route.steps.findIndex((step) => step.practice.some((item) => item.kind === "lesson" && item.href === href));
  return stepIndex === -1 ? undefined : { stepIndex };
}

/**
 * For every route that takes this lesson: the route's next lesson (`next:
 * null` when this is the route's last lesson), its previous lesson, and any
 * practice-only steps that come before the next lesson. Routes that do not
 * take the lesson are left out, so a learner who has wandered off their route
 * sees only the core-path links.
 */
export function routeNextOptions(
  moduleId: string,
  lessonSlug: string,
  resolved: readonly ResolvedRoute[] = routes(),
): RouteNextOption[] {
  const key = lessonKey(moduleId, lessonSlug);
  const href = lessonHrefOf(moduleId, lessonSlug);
  const options: RouteNextOption[] = [];
  for (const route of resolved) {
    const place = placeOnRoute(route, key, href);
    if (!place) continue;

    let following: ResolvedLesson | undefined;
    let previous: ResolvedLesson | undefined;
    let stepIndex: number;
    if ("index" in place) {
      following = route.sequence[place.index + 1];
      previous = route.sequence[place.index - 1];
      stepIndex = route.sequence[place.index].stepIndex;
    } else {
      stepIndex = place.stepIndex;
      following = route.sequence.find((lesson) => lesson.stepIndex > stepIndex);
      previous = route.sequence.filter((lesson) => lesson.stepIndex <= stepIndex).at(-1);
    }

    // Steps after this lesson's step and before the next lesson's step have no
    // lessons; name the ones that have practice, so the link does not skip them.
    const end = following ? following.stepIndex : route.steps.length;
    const between: string[] = [];
    for (let i = stepIndex + 1; i < end; i += 1) {
      if (route.steps[i].practice.length > 0) between.push(stepLabel(route, i));
    }

    options.push({
      routeId: route.id,
      routeName: route.name,
      next: following ? lessonLink(route, following) : null,
      ...(previous ? { prev: lessonLink(route, previous) } : {}),
      ...(between.length > 0 ? { between } : {}),
    });
  }
  return options;
}

/** The lesson's URL from the curriculum data, for a lesson that is not in a route's sequence. */
function lessonHrefOf(moduleId: string, lessonSlug: string): string | undefined {
  const tier = curriculumData.find((entry) => entry.sections.some((section) => section.slug === moduleId));
  return tier ? lessonHref(tier.slug, moduleId, lessonSlug) : undefined;
}
