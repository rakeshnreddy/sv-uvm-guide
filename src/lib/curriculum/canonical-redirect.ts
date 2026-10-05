/**
 * Header-level canonical redirects for lesson URLs (G30-PAGE-03, G30-LINK-V03,
 * G30-LINK-V11; NB1 lead request 1).
 *
 * The lesson page redirects every non-canonical URL form with
 * `permanentRedirect`. Under Next 14.2, an on-demand ISR render that ends in a
 * redirect is cached with its 308 status but without its `Location` header, so
 * from the second request on, clients that do not run JavaScript (curl, link
 * checkers, crawlers) get a 308 that points nowhere. `src/middleware.ts` runs
 * this check before the page cache and answers with a real 308 and `Location`
 * on every request. The page keeps its own redirect as a fallback.
 *
 * Pure and Edge-safe: it reads only the generated curriculum data through
 * `resolveCurriculumRequest`, the same classifier the page uses, so the two can
 * never disagree.
 */
import { resolveCurriculumRequest } from "@/lib/curriculum/lesson-urls";

/** Lesson URLs live below this prefix; `/curriculum` itself is the overview. */
export const CURRICULUM_PATH_PREFIX = "/curriculum/";

/** Page loads, prefetches and RSC fetches. Other methods reach the page unchanged. */
const REDIRECT_METHODS = new Set(["GET", "HEAD"]);

/**
 * The canonical lesson URL to redirect a request to, or `null` to let it through.
 *
 * Redirects pretty slugs, wrong letter case, two-segment module URLs,
 * one-segment tier URLs and extra trailing segments, exactly as the page does.
 * Returns `null` for canonical lesson URLs; for paths that are not lessons (the
 * overview, static pages such as `/curriculum/expert-index`, and URLs that match
 * no lesson, which the page answers with its 404); and for methods other than
 * GET and HEAD.
 *
 * `pathname` is the request path as the URL carries it (percent-encoded);
 * segments are decoded the way the page decodes its params.
 */
export function canonicalLessonRedirect(pathname: string, method = "GET"): string | null {
  if (!REDIRECT_METHODS.has(method.toUpperCase())) return null;
  if (!pathname.startsWith(CURRICULUM_PATH_PREFIX)) return null;
  const request = resolveCurriculumRequest(pathname.slice(CURRICULUM_PATH_PREFIX.length).split("/"));
  return request.kind === "redirect" ? request.location : null;
}
