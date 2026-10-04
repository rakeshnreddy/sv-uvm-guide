import { describe, expect, it } from 'vitest';

import { curriculumData, findPrevNextTopics } from '@/lib/curriculum-data';
import {
  PLANNED_MODULES,
  buildCurriculumOverview,
  indexOverviewLessons,
  labelWithCode,
  matchesQuery,
  moduleCode,
  moduleSearchText,
  moduleDisplayTitle,
  tierAnchor,
  type LessonPosition,
} from '@/lib/curriculum-overview';
import { readLessonMinutes, readManifestTiers } from '@/lib/curriculum-scan';
import { getAllLabs } from '@/lib/lab-registry';
import { isCanonicalLessonHref, readManifest } from '../fixtures/site-routes';

const manifest = readManifest();

function nextOf(lesson: LessonPosition): LessonPosition | undefined {
  const next = findPrevNextTopics([lesson.tierId, lesson.moduleId, lesson.lessonSlug]).next;
  if (!next) return undefined;
  const [tierId, moduleId, lessonSlug] = next.slug.split('/');
  return { tierId, moduleId, lessonSlug };
}

const tiers = buildCurriculumOverview({
  data: curriculumData,
  tiers: readManifestTiers(),
  minutesByLesson: readLessonMinutes(curriculumData),
  labs: getAllLabs(),
  nextOf,
});

describe('curriculum overview data', () => {
  it('takes tier titles and audiences from the manifest, with t1–t4 anchors', () => {
    expect(tiers.map((t) => [t.id, t.anchor, t.title, t.audience])).toEqual(
      manifest.tiers.map((t) => [t.id, tierAnchor(t.id), t.title, t.audience]),
    );
    expect(tiers.map((t) => t.anchor)).toEqual(['t1', 't2', 't3', 't4']);
  });

  it('lists modules and lessons in manifest order with track, prerequisites and milestones', () => {
    for (const [i, tier] of tiers.entries()) {
      const expected = manifest.tiers[i].modules;
      expect(tier.modules.map((m) => m.id)).toEqual(expected.map((m) => m.id));
      for (const [j, mod] of tier.modules.entries()) {
        expect(mod.track).toBe(expected[j].track);
        expect(mod.prerequisites).toEqual(expected[j].prerequisites);
        expect(mod.milestones).toEqual([...expected[j].milestones].sort());
        expect(mod.lessons.map((l) => l.slug)).toEqual(expected[j].lessons);
        expect(isCanonicalLessonHref(mod.href), mod.href).toBe(true);
        for (const lesson of mod.lessons) expect(isCanonicalLessonHref(lesson.href), lesson.href).toBe(true);
      }
      expect(tier.lessonCount).toBe(expected.reduce((n, m) => n + m.lessons.length, 0));
      expect(tier.electiveCount).toBe(expected.filter((m) => m.track === 'elective').length);
    }
  });

  it('records which modules build on each module', () => {
    const all = tiers.flatMap((t) => t.modules);
    for (const mod of all) {
      for (const dependant of mod.unlocks) {
        expect(all.find((m) => m.id === dependant)?.prerequisites, `${dependant} -> ${mod.id}`).toContain(mod.id);
      }
    }
    expect(all.find((m) => m.id === 'F1A_The_Cost_of_Bugs')?.unlocks).toEqual(['F1B_The_Verification_Mindset']);
  });

  it('lists only available labs from the registry, with sign-in routes', () => {
    const labs = getAllLabs();
    for (const mod of tiers.flatMap((t) => t.modules)) {
      for (const lab of mod.labs) {
        const registered = labs.find((l) => l.id === lab.id)!;
        expect(registered.status).toBe('available');
        expect(registered.owningModule).toBe(mod.code);
        expect(lab.href).toBe(`/practice/lab/${lab.id}`);
      }
    }
    expect(tiers[0].modules.find((m) => m.code === 'F2D')?.labs.map((l) => l.id)).toEqual(['basics-1']);
  });

  it('estimates reading time from lesson word counts', () => {
    for (const mod of tiers.flatMap((t) => t.modules)) expect(mod.minutes, mod.id).toBeGreaterThan(0);
  });

  it('points each lesson at the next lesson on the learning path', () => {
    const lessons = indexOverviewLessons(tiers);
    expect(lessons.get('F2D_Reusable_Code_and_Parallelism/ipc')?.next).toBe('F3A_Simulation_Semantics/index');
    expect(lessons.get('F2D_Reusable_Code_and_Parallelism/index')?.next).toBe('F2D_Reusable_Code_and_Parallelism/tasks-functions');
    // The core path skips the I-SV-8 elective; the elective itself returns to the path.
    expect(lessons.get('I-UVM-6_UVM_Recording_Classes/index')?.next).toBe('A-UVM-6_Scoreboards_and_Reference_Models/index');
    expect(lessons.get('I-SV-8_Power_Intent_and_UPF/index')?.next).toBe('A-UVM-6_Scoreboards_and_Reference_Models/index');
    for (const lesson of lessons.values()) if (lesson.next) expect(lessons.has(lesson.next), lesson.key).toBe(true);
  });
});

describe('overview search', () => {
  it('matches words from their start, across underscores and punctuation', () => {
    expect(matchesQuery('use uvm_config_db to pass the vif', 'config_db')).toBe(true);
    expect(matchesQuery('register abstraction layer (RAL)', 'ral')).toBe(true);
    expect(matchesQuery('general purpose integral types', 'ral')).toBe(false);
    expect(matchesQuery('Mailboxes and semaphores', 'mailbox')).toBe(true);
    expect(matchesQuery('AXI WSTRB write strobes', 'wstrb strobe')).toBe(true);
    expect(matchesQuery('AXI WSTRB write strobes', 'wstrb ahb')).toBe(false);
    expect(matchesQuery('anything', '   ')).toBe(true);
  });

  it('finds the lessons a learner would search for', () => {
    const find = (query: string) =>
      tiers.flatMap((t) => t.modules).filter((m) => matchesQuery(moduleSearchText(m), query)).map((m) => m.code);
    expect(find('mailbox')).toContain('I-SV-5');
    expect(find('WSTRB')).toContain('B-AXI-2');
    expect(find('config_db')).toContain('I-UVM-2C');
    expect(find('I-SV-5')).toEqual(['I-SV-5']);
    // Sub-lesson descriptions count too.
    expect(find('semaphores')).toEqual(expect.arrayContaining(['F2D', 'I-SV-5']));
  });
});

describe('planned modules', () => {
  const moduleIds = new Set(manifest.tiers.flatMap((t) => t.modules.map((m) => m.id)));
  const codes = new Set([...moduleIds].map(moduleCode));

  it('follow a real module in the same tier and are not published yet', () => {
    for (const planned of PLANNED_MODULES) {
      const tier = manifest.tiers.find((t) => t.id === planned.tierId);
      expect(tier?.modules.some((m) => m.id === planned.after), `${planned.code} after ${planned.after}`).toBe(true);
      expect(codes.has(planned.code), `${planned.code} now exists: remove it from PLANNED_MODULES`).toBe(false);
      const predecessor = tiers.flatMap((t) => t.modules).find((m) => m.id === planned.after)!;
      expect(planned.lane, planned.code).toBe(predecessor.lane);
    }
  });
});

describe('naming helpers', () => {
  it('derive codes, anchors and display titles', () => {
    expect(moduleCode('B-AMBA-F1_Bridges_and_System_Integration')).toBe('B-AMBA-F1');
    expect(tierAnchor('T3_Advanced')).toBe('t3');
    expect(moduleDisplayTitle('F2A: Core Data Types', 'F2A')).toBe('Core Data Types');
    expect(moduleDisplayTitle('AHB Protocol Design & Timing', 'B-AHB-1')).toBe('AHB Protocol Design & Timing');
    expect(labelWithCode('I-SV-5', 'Mailboxes')).toBe('I-SV-5: Mailboxes');
    expect(labelWithCode('F2A', 'F2A: Core Data Types')).toBe('F2A: Core Data Types');
  });
});
