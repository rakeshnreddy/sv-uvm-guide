import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { curriculumData } from '@/lib/curriculum-data';
import { getAllLabs } from '@/lib/lab-registry';
import {
  EXPERT_INDEX_HREF,
  LEARNING_ROUTES,
  MILESTONES,
  PLACEMENT_QUIZ_HREF,
  assumedModuleIds,
  getRoute,
  resolveMilestones,
  resolvePlacementPlan,
  resolveRoutes,
  validateRoutes,
  type LearningRoute,
  type ManifestLike,
} from '@/lib/learning-paths';
import {
  isRouteId,
  lastVisit,
  nextOnRoute,
  recentVisits,
  routeIdFromHash,
  type RouteLessonRef,
} from '@/lib/learning-route-state';
import { PRACTICE_KIND_LABELS as PRACTICE_MAP_KIND_LABELS, getPracticePage } from '@/lib/practice-links';
import { appRouteExists, curriculumRoot, readManifest } from '../fixtures/site-routes';

/** Kinds a resolved practice page reports: the practice map's own. */
const PAGE_KINDS = new Set<string>(['exercise', 'interactive', 'diagram', 'chart', 'tool']);

const manifest: ManifestLike = readManifest();
const labs = getAllLabs();
const modulePosition = new Map(manifest.tiers.flatMap((t) => t.modules).map((m, i) => [m.id, i]));
const manifestModule = new Map(manifest.tiers.flatMap((t) => t.modules.map((m) => [m.id, { ...m, tier: t.id }] as const)));

describe('learning routes against the manifest', () => {
  it('pass validation: modules, lessons, order, prerequisites, milestones, labs and links', () => {
    expect(validateRoutes(manifest, LEARNING_ROUTES, { labs, hrefExists: appRouteExists })).toEqual([]);
  });

  it('name lessons that exist on disk, and every prerequisite is earlier on the route, listed for review or assumed', () => {
    for (const route of LEARNING_ROUTES) {
      const covered = new Set(assumedModuleIds(route, manifest));
      for (const step of route.steps) {
        for (const id of step.review ?? []) covered.add(id);
        for (const ref of step.modules) {
          const mod = manifestModule.get(ref.id);
          expect(mod, `${route.id}/${step.id}: ${ref.id}`).toBeDefined();
          for (const lesson of ref.lessons ?? mod!.lessons) {
            const file = path.join(curriculumRoot, mod!.tier, ref.id, `${lesson}.mdx`);
            expect(fs.existsSync(file), `${route.id}/${step.id}: ${file}`).toBe(true);
          }
          for (const prerequisite of mod!.prerequisites) {
            expect(covered.has(prerequisite), `${route.id}/${step.id}: ${ref.id} needs ${prerequisite}`).toBe(true);
          }
          covered.add(ref.id);
        }
      }
    }
  });

  it('take I-UVM-4 before A-UVM-6 on the Junior route (G30-PATH-V10)', () => {
    const ids = getRoute('junior').steps.flatMap((s) => s.modules.map((m) => m.id));
    const policy = ids.indexOf('I-UVM-4_UVM_Policy_Classes');
    const scoreboards = ids.indexOf('A-UVM-6_Scoreboards_and_Reference_Models');
    expect(policy).toBeGreaterThanOrEqual(0);
    expect(scoreboards).toBeGreaterThan(policy);
  });

  it('keep each route in manifest order and visit each module once', () => {
    for (const route of LEARNING_ROUTES) {
      const positions = route.steps.flatMap((s) => s.modules.map((m) => modulePosition.get(m.id)!));
      expect([...positions].sort((a, b) => a - b), route.id).toEqual(positions);
      expect(new Set(positions).size, route.id).toBe(positions.length);
    }
  });

  it('report a forward prerequisite, an unknown lesson, a lesson out of order and a lab that is not available', () => {
    const broken: LearningRoute = {
      id: 'junior',
      name: 'Broken',
      tagline: 'test',
      audience: 'test',
      layers: 'test',
      assumes: {},
      cta: { label: 'Go' },
      steps: [
        {
          id: 'one',
          title: 'One',
          summary: 'Skips F1A and lists lessons badly.',
          modules: [
            { id: 'F1B_The_Verification_Mindset' },
            { id: 'F2D_Reusable_Code_and_Parallelism', lessons: ['ipc', 'tasks-functions', 'no-such-lesson'] },
          ],
          practice: [{ kind: 'lab', labId: 'simple-dut-1' }],
          milestones: ['M7'],
        },
      ],
    };
    const problems = validateRoutes(manifest, [broken], { labs });
    expect(problems).toEqual(
      expect.arrayContaining([
        expect.stringContaining('F1B_The_Verification_Mindset needs F1A_The_Cost_of_Bugs'),
        expect.stringContaining('lesson F2D_Reusable_Code_and_Parallelism/tasks-functions is out of manifest order'),
        expect.stringContaining('lesson F2D_Reusable_Code_and_Parallelism/no-such-lesson is not in the manifest'),
        expect.stringContaining('lab simple-dut-1 is coming_soon'),
        expect.stringContaining('milestone M7 is not fed'),
      ]),
    );
  });

  it('accept a prerequisite that is listed for review', () => {
    const reviewOnly: LearningRoute = {
      ...getRoute('expert'),
      steps: [getRoute('expert').steps.find((s) => s.id === 'formal-pss-power')!],
    };
    expect(validateRoutes(manifest, [reviewOnly]).filter((p) => p.includes('I-SV-8'))).toEqual([]);
    const withoutReview: LearningRoute = {
      ...reviewOnly,
      steps: reviewOnly.steps.map((s) => ({ ...s, review: [] })),
    };
    expect(validateRoutes(manifest, [withoutReview])).toEqual(
      expect.arrayContaining([expect.stringContaining('E-PWR-1_Power_Aware_Verification needs I-SV-8_Power_Intent_and_UPF')]),
    );
  });
});

describe('resolved routes', () => {
  const routes = resolveRoutes(curriculumData, { labs });

  it('use canonical lesson URLs that exist', () => {
    for (const route of routes) {
      expect(route.sequence.length, route.id).toBeGreaterThan(0);
      for (const lesson of route.sequence) {
        expect(lesson.href).toMatch(/^\/curriculum\/T\d_[A-Za-z]+\/[^/]+\/[a-z0-9-]+$/);
        expect(fs.existsSync(path.join(curriculumRoot, `${lesson.href.replace('/curriculum/', '')}.mdx`)), lesson.href).toBe(true);
      }
      for (const step of route.steps) {
        for (const ref of [...step.modules, ...step.review]) expect(appRouteExists(ref.href), ref.href).toBe(true);
        for (const item of step.practice) if (item.href) expect(appRouteExists(item.href), item.href).toBe(true);
      }
    }
  });

  it('start Junior at F1A, Practitioner at the placement quiz and Expert at the expert index', () => {
    const cta = Object.fromEntries(routes.map((r) => [r.id, r.cta]));
    expect(cta.junior).toEqual({ label: 'Start here', href: '/curriculum/T1_Foundational/F1A_The_Cost_of_Bugs/index' });
    expect(cta.practitioner).toEqual({ label: 'Find your level', href: PLACEMENT_QUIZ_HREF });
    expect(cta.expert).toEqual({ label: 'Expert layers', href: EXPERT_INDEX_HREF });
  });

  it('take practice page titles, kinds and routes from the practice map (NB4 request 8)', () => {
    const pageItems = LEARNING_ROUTES.flatMap((r) => r.steps.flatMap((s) => s.practice)).filter((p) => p.kind === 'page');
    expect(pageItems.length).toBeGreaterThan(10);
    for (const item of pageItems) expect(getPracticePage(item.href), item.href).toBeDefined();

    const resolved = routes.flatMap((r) => r.steps.flatMap((s) => s.practice)).filter((p) => PAGE_KINDS.has(p.kind));
    expect(resolved).toHaveLength(pageItems.length);
    for (const item of resolved) {
      const page = getPracticePage(item.href!)!;
      expect(item.label, item.href).toBe(page.title);
      expect(item.kind, item.href).toBe(page.kind);
      expect(item.kindLabel, item.href).toBe(PRACTICE_MAP_KIND_LABELS[page.kind]);
    }
    const sandbox = resolved.find((item) => item.href === '/visualizations/systemverilog-3d');
    expect(sandbox).toMatchObject({ label: 'SystemVerilog Array Sandbox', kindLabel: 'Interactive model' });
  });

  it('report and refuse a practice page that is not in the practice map', () => {
    const broken: LearningRoute = {
      ...getRoute('junior'),
      steps: [{ ...getRoute('junior').steps[0], practice: [{ kind: 'page', href: '/practice/visualizations/no-such-page' }] }],
    };
    expect(validateRoutes(manifest, [broken])).toEqual(
      expect.arrayContaining([expect.stringContaining('/practice/visualizations/no-such-page is not in PRACTICE_PAGES')]),
    );
    expect(() => resolveRoutes(curriculumData, { routes: [broken], labs })).toThrow(/not in PRACTICE_PAGES/);
  });

  it('label labs from the lab registry and say they need sign-in', () => {
    const labItems = routes.flatMap((r) => r.steps.flatMap((s) => s.practice)).filter((p) => p.kind === 'lab');
    expect(labItems.length).toBeGreaterThan(10);
    for (const item of labItems) {
      const registered = labs.find((l) => item.href === `/practice/lab/${l.id}`);
      expect(registered, item.label).toBeDefined();
      expect(item.label).toBe(registered!.title.replace(/\s+/g, ' ').trim());
      expect(item.note).toBe('sign-in required');
    }
  });

  it('list the core modules the Junior route leaves for later', () => {
    const junior = routes.find((r) => r.id === 'junior')!;
    expect(junior.skipped.map((m) => m.code)).toEqual([
      'I-SV-2B',
      'I-SV-3B',
      'I-SV-4B',
      'I-SV-4C',
      'I-SV-7',
      'I-UVM-3B',
      'I-UVM-5',
      'I-UVM-6',
    ]);
    expect(junior.milestones.map((m) => m.id)).toEqual(['M0', 'M1', 'M2', 'M3']);
    expect(routes.find((r) => r.id === 'practitioner')!.skipped).toEqual([]);
    expect(routes.find((r) => r.id === 'expert')!.skipped).toEqual([]);
  });

  it('give every lesson one step and keep step numbers in order', () => {
    for (const route of routes) {
      expect(route.steps.map((s) => s.number)).toEqual(route.steps.map((_, i) => i + 1));
      const keys = route.sequence.map((l) => l.key);
      expect(new Set(keys).size, route.id).toBe(keys.length);
      const stepIndexes = route.sequence.map((l) => l.stepIndex);
      expect([...stepIndexes].sort((a, b) => a - b), route.id).toEqual(stepIndexes);
    }
  });
});

describe('milestone ladder', () => {
  it('runs M0 to M8 and links only labs that are available', () => {
    const ladder = resolveMilestones(labs);
    expect(ladder.map((m) => m.id)).toEqual(['M0', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8']);
    for (const milestone of ladder) {
      if (!milestone.lab) continue;
      const registered = labs.find((l) => l.id === milestone.lab!.id);
      expect(registered, milestone.id).toBeDefined();
      expect(Boolean(milestone.lab.href), milestone.id).toBe(registered!.status === 'available');
    }
    expect(ladder.find((m) => m.id === 'M0')!.routes).toEqual(['junior']);
    expect(ladder.find((m) => m.id === 'M8')!.routes).toEqual(['expert']);
    expect(MILESTONES.filter((m) => !m.lab).map((m) => m.id)).toEqual(['M5']);
  });
});

describe('placement plans', () => {
  const routes = resolveRoutes(curriculumData, { labs });

  it('start at the first lesson of the chosen step and skim earlier steps', () => {
    const plan = resolvePlacementPlan(
      { tier: 2, routeId: 'junior', startStepId: 'class-based-tb', skimStepIds: ['language', 'time-and-races'] },
      routes,
    );
    expect(plan.startHref).toBe('/curriculum/T2_Intermediate/I-SV-1_OOP/index');
    expect(plan.startStepNumber).toBe(4);
    expect(plan.skim.map((s) => s.code)).toEqual(['F2A', 'F2B', 'F2C', 'F2D', 'F2E', 'F3A', 'F3B', 'F3C', 'F4A', 'F4B', 'F4C']);
  });

  it('refuse a skim step that does not come before the start', () => {
    expect(() =>
      resolvePlacementPlan({ tier: 1, routeId: 'junior', startStepId: 'why-verify', skimStepIds: ['language'] }, routes),
    ).toThrow(/does not come before/);
  });
});

describe('route state helpers', () => {
  const sequence: RouteLessonRef[] = [
    { moduleId: 'A', lessonSlug: 'index', stepIndex: 0 },
    { moduleId: 'A', lessonSlug: 'two', stepIndex: 0 },
    { moduleId: 'B', lessonSlug: 'index', stepIndex: 1 },
    { moduleId: 'C', lessonSlug: 'index', stepIndex: 2 },
  ];

  it('start at the first lesson when nothing on the route was opened', () => {
    expect(nextOnRoute(sequence, {})).toEqual({ status: 'not-started', index: 0 });
    expect(nextOnRoute(sequence, { Z: { lastVisitedAt: 5, lastVisitedLesson: 'index' } })).toEqual({
      status: 'not-started',
      index: 0,
    });
  });

  it('continue after the furthest lesson opened, even after going back to review', () => {
    expect(nextOnRoute(sequence, { A: { lastVisitedAt: 1, lastVisitedLesson: 'two' } })).toEqual({ status: 'next', index: 2 });
    expect(
      nextOnRoute(sequence, {
        B: { lastVisitedAt: 2, lastVisitedLesson: 'index' },
        A: { lastVisitedAt: 3, lastVisitedLesson: 'index' },
      }),
    ).toEqual({ status: 'next', index: 3 });
    expect(nextOnRoute(sequence, { C: { lastVisitedAt: 9, lastVisitedLesson: 'index' } })).toEqual({ status: 'complete' });
  });

  it('order recent visits newest first, one per module', () => {
    const progress = {
      A: { lastVisitedAt: 10, lastVisitedLesson: 'two' },
      B: { lastVisitedAt: 30 },
      C: { lastVisitedAt: 20, lastVisitedLesson: 'index' },
      D: {},
    };
    expect(recentVisits(progress, 2)).toEqual([
      { moduleId: 'B', lessonSlug: 'index', at: 30 },
      { moduleId: 'C', lessonSlug: 'index', at: 20 },
    ]);
    expect(lastVisit(progress)).toEqual({ moduleId: 'B', lessonSlug: 'index', at: 30 });
    expect(lastVisit({})).toBeNull();
  });

  it('read route ids from anchors', () => {
    expect(routeIdFromHash('#route-practitioner')).toBe('practitioner');
    expect(routeIdFromHash('route-expert')).toBe('expert');
    expect(routeIdFromHash('#route-staff')).toBeNull();
    expect(routeIdFromHash('#t3')).toBeNull();
    expect(isRouteId('junior')).toBe(true);
    expect(isRouteId('Junior')).toBe(false);
  });
});
