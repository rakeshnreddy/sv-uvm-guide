/**
 * Canonical lesson URLs (spine §5.9, G30-PAGE-03, G30-LINK-V03, G30-LINK-V11).
 *
 * Every lesson has exactly one URL: `/curriculum/<TierFolder>/<ModuleFolder>/<lesson>`,
 * with exact folder case and `index` for a module's first page. The lesson route
 * permanently redirects every other form that resolves to a lesson: lowercase
 * "pretty" slugs, two-segment module URLs, one-segment tier URLs and URLs with
 * extra trailing segments.
 *
 * Pure and small: it reads only the generated curriculum data, so the
 * not-found page can use the suggestions on the client.
 */
import { curriculumData, normalizeSlug, toPrettyCurriculumSlug } from "@/lib/curriculum-data";

/** `[tierFolder, moduleFolder, lessonSlug]`, as `normalizeSlug` returns it. */
export type LessonSlug = readonly [string, string, string];

export function lessonPath(slug: LessonSlug): string {
  return `/curriculum/${slug.join("/")}`;
}

/** `/curriculum/<tier>/<module>/<lesson>` for a generated topic slug such as `T1_Foundational/F2D_…/ipc`. */
export function topicPath(topicSlug: string): string {
  return `/curriculum/${topicSlug}`;
}

function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export type CurriculumRequest =
  /** The request already uses the canonical URL: render the lesson. */
  | { kind: "lesson"; slug: LessonSlug; path: string }
  /** The request resolves to a lesson through another URL form: redirect to `location`. */
  | { kind: "redirect"; slug: LessonSlug; location: string }
  /** Nothing in the curriculum matches. */
  | { kind: "not-found" };

/**
 * Classifies the segments of a `/curriculum/[...slug]` request.
 *
 * Canonical only when there are exactly three segments and each equals the
 * folder or file name byte for byte. Everything else that `normalizeSlug`
 * resolves is a redirect to the canonical URL.
 */
export function resolveCurriculumRequest(rawSegments: readonly string[] | undefined): CurriculumRequest {
  const segments = (rawSegments ?? []).map(safeDecode).filter((segment) => segment.length > 0);
  if (segments.length === 0) return { kind: "not-found" };

  const normalized = normalizeSlug([...segments]);
  if (normalized.length !== 3) return { kind: "not-found" };

  const slug: LessonSlug = [normalized[0], normalized[1], normalized[2]];
  const path = lessonPath(slug);
  const isCanonical = segments.length === 3 && segments.every((segment, index) => segment === slug[index]);
  return isCanonical ? { kind: "lesson", slug, path } : { kind: "redirect", slug, location: path };
}

/**
 * Accepts a lesson reference in any form an author or the page may pass:
 * segments, `T2_Intermediate/I-SV-1_OOP/index`, or a `/curriculum/…` URL
 * (canonical, two-segment or pretty). Returns the raw segments.
 */
export function lessonSegments(value: string | readonly string[] | undefined): string[] | undefined {
  if (value === undefined) return undefined;
  const segments = typeof value === "string"
    ? value.split(/[?#]/)[0].split("/").filter((segment) => segment.length > 0)
    : [...value];
  if (segments[0] === "curriculum") segments.shift();
  return segments.length > 0 ? segments : undefined;
}

/** The canonical URL a request resolves to, or `null` when it is not a lesson. */
export function canonicalLessonPath(rawSegments: readonly string[] | undefined): string | null {
  const request = resolveCurriculumRequest(rawSegments);
  if (request.kind === "lesson") return request.path;
  if (request.kind === "redirect") return request.location;
  return null;
}

export interface LessonSuggestion {
  href: string;
  /** Module code, for example `I-SV-5`. */
  code: string;
  /** Lesson title for a sub-lesson, module title for a module page. */
  title: string;
}

/** "I-SV-1_OOP" -> "i-sv-1"; "B-AMBA-F1_Bridges_…" -> "b-amba-f1". */
function prettyModuleCode(moduleSlug: string): string {
  return toPrettyCurriculumSlug(moduleSlug.split("_")[0] ?? moduleSlug);
}

function cleanTitle(title: string): string {
  return title.split(" | ")[0].trim();
}

/**
 * "Did you mean" links for a URL that matched nothing (G30-PAGE-04).
 *
 * Matches each path segment against module folder names, module codes and
 * lesson slugs, ignoring case, `_` versus `-`, and the `/curriculum` prefix.
 * That covers the broken relative links that escape `/curriculum`
 * (`/T2_Intermediate/I-SV-1_OOP`) and the ones that lose the tier
 * (`/curriculum/F1C_Why_SystemVerilog`).
 */
export function suggestLessonsForPath(pathname: string, limit = 3): LessonSuggestion[] {
  const segments = pathname
    .split(/[?#]/)[0]
    .split("/")
    .map((segment) => toPrettyCurriculumSlug(segment))
    .filter((segment) => segment.length > 0 && segment !== "curriculum");
  if (segments.length === 0) return [];

  const scored = new Map<string, { suggestion: LessonSuggestion; score: number; order: number }>();
  let order = 0;
  const offer = (suggestion: LessonSuggestion, score: number) => {
    const existing = scored.get(suggestion.href);
    if (!existing || existing.score < score) {
      scored.set(suggestion.href, { suggestion, score, order: existing?.order ?? order });
    }
    order += 1;
  };

  for (const tier of curriculumData) {
    for (const section of tier.sections) {
      const moduleSlug = toPrettyCurriculumSlug(section.slug);
      const code = prettyModuleCode(section.slug);
      const index = section.topics.find((topic) => topic.slug === "index") ?? section.topics[0];
      if (!index) continue;
      const moduleSuggestion: LessonSuggestion = {
        href: lessonPath([tier.slug, section.slug, index.slug]),
        code: section.slug.split("_")[0] ?? section.slug,
        title: cleanTitle(section.title),
      };

      const moduleSegment = segments.findIndex(
        (segment) => segment === moduleSlug || segment === code || segment.startsWith(`${code}-`),
      );
      if (moduleSegment === -1) continue;
      offer(moduleSuggestion, segments[moduleSegment] === moduleSlug ? 100 : 80);

      // A later segment may name one of the module's lessons ("mailbox" -> "mailboxes").
      for (const segment of segments.slice(moduleSegment + 1)) {
        for (const topic of section.topics) {
          if (topic.slug === "index") continue;
          const topicSlug = toPrettyCurriculumSlug(topic.slug);
          const exact = topicSlug === segment;
          if (exact || (segment.length >= 4 && topicSlug.startsWith(segment))) {
            offer(
              {
                href: lessonPath([tier.slug, section.slug, topic.slug]),
                code: moduleSuggestion.code,
                title: cleanTitle(topic.title),
              },
              // A named lesson is a better guess than its module's first page.
              exact ? 110 : 105,
            );
          }
        }
      }
    }
  }

  return [...scored.values()]
    .sort((left, right) => right.score - left.score || left.order - right.order)
    .slice(0, limit)
    .map(({ suggestion }) => suggestion);
}
