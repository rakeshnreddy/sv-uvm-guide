import { describe, expect, it } from 'vitest';

import { curriculumData } from '@/lib/curriculum-data';
import { buildCurriculumTotals, type StaticTier } from '@/lib/learner-stats';
import {
  TRACE_LEVEL,
  TRACE_STATES,
  cursorModuleId,
  emptyTraces,
  initialTraceIndex,
  moduleHref,
  moduleTraceState,
  progressTraces,
  tierName,
  tierTrace,
  traceKeyTarget,
  traceSegmentName,
  traceSummary,
  traceTotals,
} from '@/lib/progress-trace';

const TIER: StaticTier = {
  id: 'T1_Foundational',
  number: 1,
  label: 'Tier 1: Foundational',
  modules: [
    {
      id: 'F1A_Bugs',
      code: 'F1A',
      title: 'F1A: The Cost of Bugs',
      tierId: 'T1_Foundational',
      lessons: [{ slug: 'index', title: 'Intro', href: '/curriculum/T1_Foundational/F1A_Bugs/index' }],
    },
    {
      id: 'F1B_Mind',
      code: 'F1B',
      title: 'The Verification Mindset',
      tierId: 'T1_Foundational',
      lessons: [
        { slug: 'one', title: 'One', href: '/curriculum/T1_Foundational/F1B_Mind/one' },
        { slug: 'index', title: 'Index', href: '/curriculum/T1_Foundational/F1B_Mind/index' },
      ],
    },
    {
      id: 'F2A_Types',
      code: 'F2A',
      title: 'Data Types',
      tierId: 'T1_Foundational',
      lessons: [
        { slug: 'a', title: 'A', href: '/curriculum/T1_Foundational/F2A_Types/a' },
        { slug: 'b', title: 'B', href: '/curriculum/T1_Foundational/F2A_Types/b' },
      ],
    },
  ],
};

const NO_LOG = { lessons: {} };

describe('progress trace states', () => {
  it('reads done only when every lesson is done, opened when any lesson is', () => {
    expect(moduleTraceState({ total: 2, opened: 0, done: 0 })).toBe('not-started');
    expect(moduleTraceState({ total: 2, opened: 1, done: 0 })).toBe('opened');
    expect(moduleTraceState({ total: 2, opened: 2, done: 1 })).toBe('opened');
    expect(moduleTraceState({ total: 2, opened: 2, done: 2 })).toBe('done');
    expect(moduleTraceState({ total: 0, opened: 0, done: 0 })).toBe('not-started');
  });

  it('gives the three states three heights, low to high', () => {
    expect(TRACE_STATES.map((state) => TRACE_LEVEL[state])).toEqual([0, 0.5, 1]);
  });

  it('links a module to its index lesson, else its first lesson', () => {
    expect(moduleHref(TIER.modules[1])).toBe('/curriculum/T1_Foundational/F1B_Mind/index');
    expect(moduleHref(TIER.modules[2])).toBe('/curriculum/T1_Foundational/F2A_Types/a');
    expect(moduleHref({ lessons: [] })).toBe('/curriculum');
  });

  it('puts the cursor on the module that holds the lesson to continue, in its own tier only', () => {
    expect(cursorModuleId(TIER, '/curriculum/T1_Foundational/F2A_Types/b')).toBe('F2A_Types');
    expect(cursorModuleId(TIER, '/curriculum/T2_Intermediate/I-SV-1_OOP/index')).toBeNull();
    expect(cursorModuleId(TIER, null)).toBeNull();
  });

  it('draws every module not started, with no cursor, before progress loads', () => {
    const trace = tierTrace(TIER, null);
    expect(trace.segments.map((segment) => segment.state)).toEqual(['not-started', 'not-started', 'not-started']);
    expect(trace.cursorIndex).toBe(-1);
    expect(initialTraceIndex(trace)).toBe(0);
    expect(trace.lessonsTotal).toBe(5);
  });

  it('builds module states and the cursor from stored progress', () => {
    const [trace] = progressTraces(
      [TIER],
      {
        F1A_Bugs: { completedLessons: ['index'], lastVisitedAt: 10, lastVisitedLesson: 'index' },
        F1B_Mind: { completedLessons: ['one'], lastVisitedAt: 20, lastVisitedLesson: 'one' },
      },
      { lessons: { '/curriculum/T1_Foundational/F2A_Types/a': { firstVisitedAt: 30, lastVisitedAt: 30, visits: 1 } } },
      '/curriculum/T1_Foundational/F2A_Types/a',
    );
    expect(trace.segments.map((segment) => segment.state)).toEqual(['done', 'opened', 'opened']);
    expect(trace.cursorIndex).toBe(2);
    expect(initialTraceIndex(trace)).toBe(2);
    expect(trace.modulesDone).toBe(1);
    expect(trace.modulesOpened).toBe(3);
    expect(trace.lessonsDone).toBe(2);
    expect(traceSummary(trace)).toBe('1 of 3 modules done, 2 more opened');
    expect(trace.lessonsOpened).toBe(3);
    expect(traceTotals(trace)).toBe('1 of 3 modules · 2 of 5 lessons done · 1 more opened');
  });

  it('adds the opened count to the totals only when lessons are opened but not done', () => {
    const base = { segments: tierTrace(TIER, null).segments.slice(0, 2), modulesDone: 1, lessonsDone: 2, lessonsTotal: 4 };
    expect(traceTotals({ ...base, lessonsOpened: 2 })).toBe('1 of 2 modules · 2 of 4 lessons done');
    expect(traceTotals({ ...base, lessonsOpened: 3 })).toBe('1 of 2 modules · 2 of 4 lessons done · 1 more opened');
  });

  it('names each segment with its code, title without the code, state and the cursor', () => {
    const [trace] = progressTraces([TIER], {}, NO_LOG, '/curriculum/T1_Foundational/F1A_Bugs/index');
    expect(trace.segments[0].title).toBe('The Cost of Bugs');
    expect(traceSegmentName(trace.segments[0])).toBe('F1A: The Cost of Bugs, not started, where you are');
    expect(traceSegmentName({ ...trace.segments[1], state: 'done' })).toBe('F1B: The Verification Mindset, done');
  });

  it('names tiers from the navigation config, so tier 1 reads "Tier 1: Foundations"', () => {
    expect(tierName('T1_Foundational', 'Tier 1: Foundational')).toBe('Tier 1: Foundations');
    expect(tierTrace(TIER, null).label).toBe('Tier 1: Foundations');
    expect(tierName('T9_Unknown', 'Fallback')).toBe('Fallback');
    const names = emptyTraces(buildCurriculumTotals(curriculumData)).map((trace) => trace.label);
    expect(names[0]).toBe('Tier 1: Foundations');
    expect(names).toHaveLength(curriculumData.length);
  });
});

describe('progress trace keyboard', () => {
  it('moves with Left and Right, jumps with Home and End, and stops at the ends', () => {
    expect(traceKeyTarget('ArrowRight', 0, 3)).toBe(1);
    expect(traceKeyTarget('ArrowRight', 2, 3)).toBe(2);
    expect(traceKeyTarget('ArrowLeft', 0, 3)).toBe(0);
    expect(traceKeyTarget('ArrowLeft', 2, 3)).toBe(1);
    expect(traceKeyTarget('Home', 2, 3)).toBe(0);
    expect(traceKeyTarget('End', 0, 3)).toBe(2);
  });

  it('leaves other keys alone, Up and Down included, so the page still scrolls', () => {
    expect(traceKeyTarget('ArrowDown', 0, 3)).toBeNull();
    expect(traceKeyTarget('ArrowUp', 1, 3)).toBeNull();
    expect(traceKeyTarget('Enter', 1, 3)).toBeNull();
    expect(traceKeyTarget('ArrowRight', 0, 0)).toBeNull();
  });
});
