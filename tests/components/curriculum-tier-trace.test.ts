import { describe, expect, it } from 'vitest';

import { cursorModule, moduleStates, staticTierOf, tierProgressText } from '@/components/curriculum/tier-trace';
import { curriculumData } from '@/lib/curriculum-data';
import { buildCurriculumOverview } from '@/lib/curriculum-overview';
import { readManifestTiers } from '@/lib/curriculum-scan';
import { buildCurriculumTotals } from '@/lib/learner-stats';
import { progressTraces } from '@/lib/progress-trace';

const overview = buildCurriculumOverview({ data: curriculumData, tiers: readManifestTiers() });
const totals = buildCurriculumTotals(curriculumData);

describe('staticTierOf', () => {
  it('gives the same tiers, modules and lessons as the dashboard totals, so the index draws the same traces', () => {
    const built = overview.map(staticTierOf);
    expect(built.map((t) => [t.id, t.number, t.label])).toEqual(totals.map((t) => [t.id, t.number, t.label]));
    built.forEach((tier, index) => {
      const expected = totals[index];
      expect(tier.modules.map((m) => [m.id, m.code, m.tierId, m.lessons.map((l) => [l.slug, l.href])])).toEqual(
        expected.modules.map((m) => [m.id, m.code, m.tierId, m.lessons.map((l) => [l.slug, l.href])]),
      );
    });
  });
});

describe('moduleStates and cursorModule', () => {
  it('read each module’s state and the cursor from the traces', () => {
    const tiers = overview.map(staticTierOf);
    const f2d = tiers[0].modules.find((m) => m.id.startsWith('F2D_'))!;
    const traces = progressTraces(
      tiers,
      {
        F1A_The_Cost_of_Bugs: { completedLessons: ['index'], lastVisitedAt: 1, lastVisitedLesson: 'index' },
        [f2d.id]: { completedLessons: [], lastVisitedAt: 2, lastVisitedLesson: 'ipc' },
      },
      { lessons: {} },
      f2d.lessons.find((l) => l.slug === 'ipc')!.href,
    );
    const states = moduleStates(traces);
    expect(states.get('F1A_The_Cost_of_Bugs')).toBe('done');
    expect(states.get(f2d.id)).toBe('opened');
    expect(states.get(tiers[1].modules[0].id)).toBe('not-started');
    expect(cursorModule(traces)).toBe(f2d.id);
    expect(cursorModule(progressTraces(tiers, {}, { lessons: {} }, null))).toBeUndefined();
  });
});

describe('tierProgressText', () => {
  it('says how many modules are done and how many more are opened, and nothing before any progress', () => {
    expect(tierProgressText({ modulesDone: 0, modulesOpened: 0 })).toBeNull();
    expect(tierProgressText({ modulesDone: 2, modulesOpened: 2 })).toBe('2 done');
    expect(tierProgressText({ modulesDone: 2, modulesOpened: 3 })).toBe('2 done · 1 opened');
    expect(tierProgressText({ modulesDone: 0, modulesOpened: 1 })).toBe('0 done · 1 opened');
  });
});
