import { normalizeSlug } from './curriculum-data';

/**
 * Converts a curriculum slug into a concrete href. Accepts 1–3 segments and
 * relies on `normalizeSlug` to expand partial slugs (e.g., tier-only) to a
 * fully-qualified topic path.
 */
export function resolveCurriculumPath(slug: string[], fallback?: string): string {
  const normalized = normalizeSlug(slug);
  if (normalized.length === 3) {
    return `/curriculum/${normalized.join('/')}`;
  }

  if (fallback) {
    return fallback;
  }

  if (process.env.NODE_ENV !== 'production') {
    console.warn('resolveCurriculumPath: unable to resolve slug', slug);
  }
  return '#';
}

/**
 * Returns the first lesson within a tier/section chain, allowing UI surfaces to
 * link to a sensible starting lesson without hardcoding `index` topics.
 */
export function getEntryPointSlug(slug: string[]): string[] | null {
  const normalized = normalizeSlug(slug);
  return normalized.length === 3 ? normalized : null;
}
