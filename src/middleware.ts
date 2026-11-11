import { NextResponse, type NextRequest } from "next/server";

import { curriculumData, toPrettyCurriculumSlug } from "@/lib/curriculum-data";
import { canonicalLessonRedirect } from "@/lib/curriculum/canonical-redirect";
import { PRACTICE_SECTION_HREF, tierSectionHref } from "@/lib/site-links";

/**
 * Header-level redirects, on every request (the page cache never answers
 * these URLs first):
 *
 * - Index pages that moved into a section of another page answer with a
 *   temporary 307 to that section (SPEC-phases-2-4.md, "URLs"): a tier URL
 *   (/curriculum/T1_Foundational, in any case or pretty form) goes to its
 *   section of /curriculum, and /exercises, /labs, /practice/lab,
 *   /practice/visualizations and /visualizations go to their section of
 *   /practice. Only those exact URLs move; item URLs below them do not.
 *   The anchors come from src/lib/site-links.ts, so they cannot drift from
 *   the ids the pages render. The Location header carries the fragment.
 * - Non-canonical lesson URLs answer with a 308 to the canonical one
 *   (src/lib/curriculum/canonical-redirect.ts explains why the page's own
 *   redirect is not enough under ISR).
 *
 * The legacy redirects in next.config.mjs run before middleware, so this sees
 * only URLs they did not match. Every other request passes through unchanged.
 * Redirects here work the same in `next dev` and under OpenNext on
 * Cloudflare, which runs this middleware before its cache.
 */

/** Page loads, prefetches and RSC fetches. Other methods reach the page unchanged. */
const REDIRECT_METHODS = new Set(["GET", "HEAD"]);

/** Index URLs that are now sections of /practice. */
export const PRACTICE_INDEX_REDIRECTS: Readonly<Record<string, string>> = {
  "/exercises": PRACTICE_SECTION_HREF.exercises,
  "/labs": PRACTICE_SECTION_HREF.labs,
  "/practice/lab": PRACTICE_SECTION_HREF.labs,
  "/practice/visualizations": PRACTICE_SECTION_HREF.interactiveModels,
  "/visualizations": PRACTICE_SECTION_HREF.interactiveModels,
};

function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** The tier folder a one-segment /curriculum/<tier> URL names, matched like the lesson route matches it. */
function tierForSegment(segment: string) {
  const decoded = safeDecode(segment);
  const pretty = toPrettyCurriculumSlug(decoded);
  return curriculumData.find((tier) => tier.slug === decoded || toPrettyCurriculumSlug(tier.slug) === pretty);
}

/**
 * Where an index URL that became a page section redirects to (`/practice#labs`,
 * `/curriculum#t1`), or `null`. GET and HEAD only; a trailing slash is ignored.
 */
export function sectionRedirect(pathname: string, method = "GET"): string | null {
  if (!REDIRECT_METHODS.has(method.toUpperCase())) return null;
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const practice = PRACTICE_INDEX_REDIRECTS[path];
  if (practice) return practice;

  const match = /^\/curriculum\/([^/]+)$/.exec(path);
  if (!match) return null;
  const tier = tierForSegment(match[1]);
  return tier ? tierSectionHref(tier.slug) : null;
}

/** An absolute redirect URL for `location` (path, optional query, optional #fragment), keeping the request's query when `location` has none. */
function redirectUrl(request: NextRequest, location: string): URL {
  const url = request.nextUrl.clone();
  const [pathAndQuery, hash = ""] = location.split("#");
  const [pathname, search] = pathAndQuery.split("?");
  url.pathname = pathname;
  if (search !== undefined) url.search = `?${search}`;
  url.hash = hash ? `#${hash}` : "";
  return url;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const section = sectionRedirect(pathname, request.method);
  if (section) return NextResponse.redirect(redirectUrl(request, section), 307);

  const location = canonicalLessonRedirect(pathname, request.method);
  if (!location) return NextResponse.next();

  // Keep the query string; browsers keep the #fragment across a redirect by themselves.
  const url = request.nextUrl.clone();
  url.pathname = location;
  return NextResponse.redirect(url, 308);
}

export const config = {
  // Lesson URLs and the five moved index URLs only: the overview (/curriculum),
  // item pages and the rest of the site never run middleware.
  matcher: ["/curriculum/:path+", "/exercises", "/labs", "/practice/lab", "/practice/visualizations", "/visualizations"],
};
