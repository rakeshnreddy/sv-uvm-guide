/**
 * The curriculum index's progress traces (SPEC-phases-2-4.md, "Progress
 * trace"): the overview tiers the page already holds, turned into the shape
 * src/lib/progress-trace.ts reads, so the index draws the same traces as the
 * dashboard without a second copy of the curriculum in the page payload.
 * Pure: no storage, no clock.
 */
import type { OverviewTier } from '@/lib/curriculum-overview';
import type { StaticTier } from '@/lib/learner-stats';
import { tierName, type TierTrace, type TraceState } from '@/lib/progress-trace';

/**
 * One overview tier as a StaticTier (src/lib/learner-stats.ts): the same
 * module ids, codes and lessons in the same order as buildCurriculumTotals
 * gives the dashboard (a unit test holds them equal).
 */
export function staticTierOf(tier: OverviewTier): StaticTier {
  return {
    id: tier.id,
    number: tier.number,
    label: tierName(tier.id, tier.title),
    modules: tier.modules.map((mod) => ({
      id: mod.id,
      code: mod.code,
      title: mod.title,
      tierId: tier.id,
      lessons: mod.lessons.map(({ slug, title, href }) => ({ slug, title, href })),
    })),
  };
}

/** Every module's state across the traces, by module id ("F2D_Reusable_Code_and_Parallelism" -> "opened"). */
export function moduleStates(traces: readonly TierTrace[]): ReadonlyMap<string, TraceState> {
  return new Map(traces.flatMap((trace) => trace.segments.map((segment) => [segment.id, segment.state] as const)));
}

/** The module the trace cursor marks (the module of the lesson to continue), or undefined. */
export function cursorModule(traces: readonly TierTrace[]): string | undefined {
  for (const trace of traces) {
    const segment = trace.segments[trace.cursorIndex];
    if (segment) return segment.id;
  }
  return undefined;
}

/**
 * The tier's progress in words, for the meta line beside its miniature trace:
 * "2 done" or "2 done · 1 opened" (modules; "opened" counts the modules opened
 * and not yet done). Null while nothing in the tier is opened, so a first
 * visit shows only the static totals.
 */
export function tierProgressText(trace: Pick<TierTrace, 'modulesDone' | 'modulesOpened'>): string | null {
  const openedOnly = Math.max(0, trace.modulesOpened - trace.modulesDone);
  if (trace.modulesDone === 0 && openedOnly === 0) return null;
  return openedOnly > 0 ? `${trace.modulesDone} done · ${openedOnly} opened` : `${trace.modulesDone} done`;
}
