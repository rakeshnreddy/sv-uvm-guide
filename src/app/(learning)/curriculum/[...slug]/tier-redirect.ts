import { normalizeSlug } from "@/lib/curriculum-data";
import { tierSectionHref } from "@/lib/site-links";

function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/**
 * Where a tier URL goes: "/curriculum/T3_Advanced" (or any accepted spelling,
 * such as "t3-advanced") -> "/curriculum#t3", the tier's section of the
 * overview (SPEC-phases-2-4.md, "URLs"). Null for anything that is not a
 * one-segment tier URL. There are no tier pages: the lesson route answers a
 * tier URL with a temporary redirect to this href.
 */
export function tierRedirectHref(rawSegments: readonly string[] | undefined): string | null {
  const segments = (rawSegments ?? []).map(safeDecode).filter((segment) => segment.length > 0);
  if (segments.length !== 1) return null;
  const [tierId] = normalizeSlug(segments);
  return tierId ? tierSectionHref(tierId) : null;
}
