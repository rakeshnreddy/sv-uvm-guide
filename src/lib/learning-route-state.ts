/**
 * The learner's chosen route and where they are on it.
 *
 * Client-safe and small: no curriculum data and no route definitions, so the
 * overview's client components can import it cheaply. The routes themselves
 * live in src/lib/learning-paths.ts.
 *
 * The choice is a per-browser convenience (localStorage). Nothing depends on
 * it: without storage the choice lasts until the page reloads.
 */

export type RouteId = 'junior' | 'practitioner' | 'expert';

export const ROUTE_IDS: readonly RouteId[] = ['junior', 'practitioner', 'expert'];

export function isRouteId(value: unknown): value is RouteId {
  return value === 'junior' || value === 'practitioner' || value === 'expert';
}

/** Anchor of a route on /curriculum: "/curriculum#route-junior" opens the Junior route. */
export function routeAnchor(id: RouteId): string {
  return `route-${id}`;
}

export function routeIdFromHash(hash: string): RouteId | null {
  const match = /^#?route-([a-z]+)$/.exec(hash);
  return match && isRouteId(match[1]) ? match[1] : null;
}

// ---------------------------------------------------------------------------
// Visits (the shape useCurriculumProgress stores under "curriculumProgress")
// ---------------------------------------------------------------------------

export interface ModuleVisit {
  lastVisitedAt?: number;
  lastVisitedLesson?: string;
}

export type ProgressLike = Readonly<Record<string, ModuleVisit | undefined>>;

export interface Visit {
  moduleId: string;
  lessonSlug: string;
  at: number;
}

/** The most recent visits, newest first: one per module, because progress keeps the last lesson per module. */
export function recentVisits(progress: ProgressLike, limit = 3): Visit[] {
  const visits: Visit[] = [];
  for (const [moduleId, entry] of Object.entries(progress)) {
    if (!entry?.lastVisitedAt) continue;
    visits.push({ moduleId, lessonSlug: entry.lastVisitedLesson ?? 'index', at: entry.lastVisitedAt });
  }
  return visits.sort((a, b) => b.at - a.at).slice(0, Math.max(0, limit));
}

export function lastVisit(progress: ProgressLike): Visit | null {
  return recentVisits(progress, 1)[0] ?? null;
}

// ---------------------------------------------------------------------------
// Position on a route
// ---------------------------------------------------------------------------

/** A lesson on a route, as the client needs it. */
export interface RouteLessonRef {
  moduleId: string;
  lessonSlug: string;
  /** Zero-based index of the route step that contains the lesson. */
  stepIndex: number;
}

export type RouteProgress =
  | { status: 'not-started'; index: 0 }
  | { status: 'next'; index: number }
  | { status: 'complete' };

/**
 * The next lesson on a route: the one after the furthest route lesson the
 * learner has opened (each module remembers its last opened lesson), or the
 * route's first lesson when none has been opened. Going back to review an
 * earlier lesson does not move the learner back on the route.
 */
export function nextOnRoute(sequence: readonly RouteLessonRef[], progress: ProgressLike): RouteProgress {
  if (sequence.length === 0) return { status: 'complete' };
  let furthest = -1;
  sequence.forEach((lesson, i) => {
    const visit = progress[lesson.moduleId];
    if (visit?.lastVisitedAt && (visit.lastVisitedLesson ?? 'index') === lesson.lessonSlug) furthest = i;
  });
  if (furthest < 0) return { status: 'not-started', index: 0 };
  if (furthest >= sequence.length - 1) return { status: 'complete' };
  return { status: 'next', index: furthest + 1 };
}

// ---------------------------------------------------------------------------
// The chosen route (per browser)
// ---------------------------------------------------------------------------

export const ROUTE_STORAGE_KEY = 'svuvm.learningRoute';
const ROUTE_CHANGE_EVENT = 'svuvm:learning-route-change';

// When storage is unavailable (private mode, blocked site data) the choice
// lives in memory, so it still holds until the page is reloaded.
let memoryChoice: RouteId | null = null;
let storageUnavailable = false;

export function readSelectedRoute(): RouteId | null {
  if (typeof window === 'undefined') return null;
  if (storageUnavailable) return memoryChoice;
  try {
    const value = window.localStorage.getItem(ROUTE_STORAGE_KEY);
    return isRouteId(value) ? value : null;
  } catch {
    storageUnavailable = true;
    return memoryChoice;
  }
}

export function writeSelectedRoute(id: RouteId | null): void {
  if (typeof window === 'undefined') return;
  memoryChoice = id;
  try {
    if (id) window.localStorage.setItem(ROUTE_STORAGE_KEY, id);
    else window.localStorage.removeItem(ROUTE_STORAGE_KEY);
  } catch {
    storageUnavailable = true;
  }
  window.dispatchEvent(new CustomEvent(ROUTE_CHANGE_EVENT, { detail: id }));
}

/** Subscribes to route changes from this tab and from other tabs. Returns the unsubscribe function. */
export function subscribeSelectedRoute(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === ROUTE_STORAGE_KEY) onChange();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(ROUTE_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(ROUTE_CHANGE_EVENT, onChange);
  };
}
