/**
 * The progress trace (SPEC-phases-2-4.md, "Progress trace"; DESIGN.md section
 * 10): progress through one tier drawn as a signal, one segment per module in
 * course order. A module is low when not started, half height when opened and
 * high when done; a cursor marks the module of the lesson to continue.
 *
 * This file is the pure part: module states, the cursor, the names assistive
 * technology read and the keyboard step, from plain data. It reads no
 * storage and no clock, so it is unit-tested without a browser and the server
 * can build the not-started trace for the first render.
 */
import {
  tierAndModuleProgress,
  type ModuleProgressSummary,
  type StaticModule,
  type StaticTier,
  type TierProgressSummary,
} from '@/lib/learner-stats';
import { moduleDisplayTitle } from '@/lib/curriculum-overview';
import type { CurriculumProgressData, LessonLogData } from '@/lib/learner-store/repositories/lessons';
import { CURRICULUM_HREF, TIER_LINKS, tierSectionHref } from '@/lib/site-links';
import { tierOfTierSlug, type TierNumber } from '@/lib/tier-colors';

export type TraceState = 'not-started' | 'opened' | 'done';

/** The three states in words, for the legend and the segment names. */
export const TRACE_STATE_LABEL: Readonly<Record<TraceState, string>> = Object.freeze({
  'not-started': 'Not started',
  opened: 'Opened',
  done: 'Done',
});

/** The legend's order: low, half, high. */
export const TRACE_STATES: readonly TraceState[] = Object.freeze(['not-started', 'opened', 'done']);

/** Height of each state as a fraction of the trace: low, half, high. */
export const TRACE_LEVEL: Readonly<Record<TraceState, number>> = Object.freeze({
  'not-started': 0,
  opened: 0.5,
  done: 1,
});

export interface TraceSegment {
  /** The module folder, the key 'curriculumProgress' uses. */
  id: string;
  code: string;
  /** The title without its code: "The Cost of Bugs". */
  title: string;
  /** The module's first page: its index lesson, else its first lesson. */
  href: string;
  state: TraceState;
  lessonsDone: number;
  lessonsTotal: number;
  /** The module of the lesson to continue. */
  current: boolean;
}

export interface TierTrace {
  tierId: string;
  tier: TierNumber | undefined;
  /** "Tier 1: Foundations", from the navigation config. */
  label: string;
  segments: TraceSegment[];
  /** Index of the current segment, or -1 when the lesson to continue is in another tier (or there is none). */
  cursorIndex: number;
  modulesDone: number;
  modulesOpened: number;
  lessonsTotal: number;
  lessonsDone: number;
  lessonsOpened: number;
}

/**
 * A tier's one name, as the rest of the site shows it ("Tier 1: Foundations"):
 * the label of the tier's link in src/lib/site-links.ts. `fallback` is used
 * only for a tier the navigation config does not know.
 */
export function tierName(tierId: string, fallback: string = tierId): string {
  const href = tierSectionHref(tierId);
  return TIER_LINKS.find((link) => link.href === href)?.label ?? fallback;
}

/** A module's state from its lesson counts: done when every lesson is done, opened when any lesson is. */
export function moduleTraceState(counts: Pick<ModuleProgressSummary, 'total' | 'opened' | 'done'>): TraceState {
  if (counts.total > 0 && counts.done >= counts.total) return 'done';
  if (counts.opened > 0 || counts.done > 0) return 'opened';
  return 'not-started';
}

/** Where a module's segment links: its index lesson, else its first lesson, else the curriculum. */
export function moduleHref(mod: Pick<StaticModule, 'lessons'>): string {
  const first = mod.lessons.find((lesson) => lesson.slug === 'index') ?? mod.lessons[0];
  return first?.href ?? CURRICULUM_HREF;
}

/** The id of the module in `tier` that holds the lesson at `lessonHref`, or null. */
export function cursorModuleId(tier: Pick<StaticTier, 'modules'>, lessonHref: string | null | undefined): string | null {
  if (!lessonHref) return null;
  return tier.modules.find((mod) => mod.lessons.some((lesson) => lesson.href === lessonHref))?.id ?? null;
}

/**
 * One tier's trace. `summary` is the tier's entry from tierAndModuleProgress;
 * null draws every module not started (the server render and a new visitor).
 * `continueHref` is the lesson to continue (src/lib/continue-lesson.ts).
 */
export function tierTrace(
  tier: StaticTier,
  summary: Pick<TierProgressSummary, 'modules'> | null,
  continueHref: string | null = null,
): TierTrace {
  const counts = new Map((summary?.modules ?? []).map((mod) => [mod.id, mod]));
  const cursorId = cursorModuleId(tier, continueHref);
  const segments = tier.modules.map((mod): TraceSegment => {
    const count = counts.get(mod.id);
    const total = mod.lessons.length;
    return {
      id: mod.id,
      code: mod.code,
      title: moduleDisplayTitle(mod.title, mod.code),
      href: moduleHref(mod),
      state: count ? moduleTraceState(count) : 'not-started',
      lessonsDone: count?.done ?? 0,
      lessonsTotal: total,
      current: mod.id === cursorId,
    };
  });
  let lessonsDone = 0;
  let lessonsOpened = 0;
  for (const mod of summary?.modules ?? []) {
    lessonsDone += mod.done;
    lessonsOpened += mod.opened;
  }
  return {
    tierId: tier.id,
    tier: tierOfTierSlug(tier.id),
    label: tierName(tier.id, tier.label),
    segments,
    cursorIndex: segments.findIndex((segment) => segment.current),
    modulesDone: segments.filter((segment) => segment.state === 'done').length,
    modulesOpened: segments.filter((segment) => segment.state !== 'not-started').length,
    lessonsTotal: segments.reduce((sum, segment) => sum + segment.lessonsTotal, 0),
    lessonsDone,
    lessonsOpened,
  };
}

/** Every tier with every module not started and no cursor: what the server renders. */
export function emptyTraces(tiers: readonly StaticTier[]): TierTrace[] {
  return tiers.map((tier) => tierTrace(tier, null));
}

/** Every tier's trace from the records in this browser and the lesson to continue. */
export function progressTraces(
  tiers: readonly StaticTier[],
  progress: CurriculumProgressData,
  lessonLog: LessonLogData,
  continueHref: string | null,
): TierTrace[] {
  const summary = tierAndModuleProgress(tiers, progress, lessonLog);
  return tiers.map((tier, index) => tierTrace(tier, summary.tiers[index] ?? null, continueHref));
}

/** What a segment says to assistive technology: "F1B: The Verification Mindset, opened, where you are". */
export function traceSegmentName(segment: Pick<TraceSegment, 'code' | 'title' | 'state' | 'current'>): string {
  const state = TRACE_STATE_LABEL[segment.state].toLowerCase();
  return `${segment.code}: ${segment.title}, ${state}${segment.current ? ', where you are' : ''}`;
}

/** The trace's totals for assistive technology: "3 of 14 modules done, 2 more opened". */
export function traceSummary(trace: Pick<TierTrace, 'segments' | 'modulesDone' | 'modulesOpened'>): string {
  const total = trace.segments.length;
  const openedOnly = trace.modulesOpened - trace.modulesDone;
  const done = `${trace.modulesDone} of ${total} ${total === 1 ? 'module' : 'modules'} done`;
  return openedOnly > 0 ? `${done}, ${openedOnly} more opened` : done;
}

/**
 * The tier's visible totals: "3 of 14 modules · 7 of 28 lessons done", then
 * " · 2 more opened" when lessons are opened but not yet done (the one sign of
 * work started and not finished). Short, so it stays on one line.
 */
export function traceTotals(
  trace: Pick<TierTrace, 'segments' | 'modulesDone' | 'lessonsDone' | 'lessonsOpened' | 'lessonsTotal'>,
): string {
  const done = `${trace.modulesDone} of ${trace.segments.length} modules · ${trace.lessonsDone} of ${trace.lessonsTotal} lessons done`;
  const openedOnly = trace.lessonsOpened - trace.lessonsDone;
  return openedOnly > 0 ? `${done} · ${openedOnly} more opened` : done;
}

/**
 * The keyboard step for a trace's one tab stop (a roving tabindex, as in a
 * toolbar): Left moves back, Right moves on, Home and End jump to the ends. It
 * stops at the ends. Null for any other key (Up and Down included), so the key
 * keeps its usual job, such as scrolling the page.
 */
export function traceKeyTarget(key: string, index: number, count: number): number | null {
  if (count <= 0) return null;
  switch (key) {
    case 'ArrowLeft':
      return Math.max(0, index - 1);
    case 'ArrowRight':
      return Math.min(count - 1, index + 1);
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}

/** The segment that holds the tab stop before the learner moves it: where they are, else the first. */
export function initialTraceIndex(trace: Pick<TierTrace, 'cursorIndex'>): number {
  return trace.cursorIndex >= 0 ? trace.cursorIndex : 0;
}

/**
 * Which segment the readout under a full trace names: the one under the
 * pointer or focus, else the cursor's, else none. So at rest only the tier the
 * learner is in names a module.
 */
export function readoutIndex(shown: number | null, cursorIndex: number): number | null {
  if (shown !== null) return shown;
  return cursorIndex >= 0 ? cursorIndex : null;
}
