import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { findTopicBySlug, normalizeSlug } from '@/lib/curriculum-data';
import type { LabManifest } from '@/lib/lab-manifest';
import { getAllLabs, getLabById } from '@/lib/lab-registry';
import {
  INTERVIEW_BANK_LESSONS,
  INTERVIEW_QUESTION_LESSONS,
  LAB_LESSON_OVERRIDES,
  PRACTICE_PAGES,
  allLessons,
  getLabBackLink,
  getLabLessons,
  getLabPrerequisites,
  getLessonsForPractice,
  getPracticeForLesson,
  getPracticeForModule,
  getPracticeLabItems,
  getPracticePage,
  getPracticePages,
  moduleCodeOf,
  requirePracticePage,
  resolveLessonRef,
  type LessonLink,
} from '@/lib/practice-links';

const repoRoot = path.resolve(__dirname, '../..');
const learningRoutes = path.join(repoRoot, 'src', 'app', '(learning)');

/**
 * Practice pages whose page.tsx is owned by another workstream and does not
 * render <LearnInLesson /> yet. When the back link lands, remove the route here.
 */
const PENDING_BACK_LINKS = new Set(['/visualizations/systemverilog-3d']);

const CANONICAL_LESSON_URL = /^\/curriculum\/T[1-4]_[A-Za-z]+\/[^/]+\/[^/]+$/;

function expectCanonical(lesson: LessonLink | undefined, ref: string) {
  expect(lesson, `${ref} does not name a lesson in the generated curriculum`).toBeDefined();
  if (!lesson) return;
  expect(lesson.href).toMatch(CANONICAL_LESSON_URL);
  const segments = lesson.href.split('/').slice(2);
  expect(normalizeSlug(segments), `${lesson.href} is not canonical`).toEqual(segments);
  expect(findTopicBySlug(segments), `${lesson.href} does not resolve`).toBeDefined();
}

function lessonSource(lesson: LessonLink): string {
  const [tier, moduleSlug, lessonSlug] = lesson.href.split('/').slice(2);
  return fs.readFileSync(path.join(repoRoot, 'content', 'curriculum', tier, moduleSlug, `${lessonSlug}.mdx`), 'utf8');
}

/** Routes of every exercise, practice visualization and tool page in the app. */
function discoverPracticeRoutes(): string[] {
  const routes: string[] = [];
  const childPages = (segments: string[], skip: string[] = []) => {
    const dir = path.join(learningRoutes, ...segments);
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || skip.includes(entry.name) || /^[[(]/.test(entry.name)) continue;
      if (fs.existsSync(path.join(dir, entry.name, 'page.tsx'))) routes.push(`/${[...segments, entry.name].join('/')}`);
    }
  };
  childPages(['exercises']);
  childPages(['practice', 'visualizations']);
  childPages(['practice'], ['lab', 'visualizations']); // tools such as /practice/waveform-studio
  childPages(['visualizations']);
  return routes.sort();
}

function pageSource(href: string): string {
  return fs.readFileSync(path.join(learningRoutes, ...href.split('/').filter(Boolean), 'page.tsx'), 'utf8');
}

const availableLabs = getAllLabs().filter((lab) => lab.status === 'available');

describe('practice map targets', () => {
  const entries: [string, readonly string[]][] = [
    ...PRACTICE_PAGES.map((page): [string, readonly string[]] => [page.href, page.lessons]),
    ...Object.entries(LAB_LESSON_OVERRIDES).map(([id, refs]): [string, readonly string[]] => [`lab ${id}`, refs]),
    ...Object.entries(INTERVIEW_BANK_LESSONS).map(([topic, refs]): [string, readonly string[]] => [`bank ${topic}`, refs]),
    ...Object.entries(INTERVIEW_QUESTION_LESSONS).map(([id, refs]): [string, readonly string[]] => [`question ${id}`, refs]),
  ];

  it.each(entries)('%s: every lesson resolves to a canonical lesson URL', (_name, refs) => {
    expect(refs.length).toBeGreaterThan(0);
    expect(new Set(refs).size, 'duplicate lesson in one entry').toBe(refs.length);
    for (const ref of refs) {
      expect(ref, 'write lessons as <ModuleFolder>/<lesson>').toMatch(/^[^/]+\/[^/]+$/);
      expectCanonical(resolveLessonRef(ref), ref);
    }
  });

  it('resolves lessons in manifest order', () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'content', 'curriculum', 'curriculum.manifest.json'), 'utf8'),
    ) as { tiers: { modules: { id: string; lessons: string[] }[] }[] };
    const manifestOrder = manifest.tiers.flatMap((tier) =>
      tier.modules.flatMap((module) => module.lessons.map((lesson) => `${module.id}/${lesson}`)),
    );
    const lessons = allLessons();
    expect(lessons.map((lesson) => lesson.ref)).toEqual(manifestOrder);
    lessons.forEach((lesson, index) => expect(lesson.order).toBe(index));
  });

  it('strips legacy site suffixes and module codes from lesson titles', () => {
    for (const lesson of allLessons()) {
      expect(lesson.title, lesson.ref).not.toContain(' | ');
      expect(lesson.title.startsWith(`${lesson.code}:`), lesson.ref).toBe(false);
      expect(lesson.title.length, lesson.ref).toBeGreaterThan(0);
    }
  });
});

describe('practice pages', () => {
  it('maps every exercise, practice visualization and tool route, and nothing else', () => {
    expect(discoverPracticeRoutes()).toEqual(PRACTICE_PAGES.map((page) => page.href).sort());
  });

  it('has unique routes and titles', () => {
    expect(new Set(PRACTICE_PAGES.map((page) => page.href)).size).toBe(PRACTICE_PAGES.length);
    expect(new Set(PRACTICE_PAGES.map((page) => page.title)).size).toBe(PRACTICE_PAGES.length);
  });

  it.each(PRACTICE_PAGES.map((page) => [page.href]))('%s renders its "Learn this in" back link from the map', (href) => {
    const source = pageSource(href);
    // Either requirePracticePage('<href>') or `const HREF = '<href>'` passed to requirePracticePage(HREF).
    const declares =
      source.includes('<LearnInLesson item={') && source.includes('requirePracticePage(') && source.includes(`'${href}'`);
    if (PENDING_BACK_LINKS.has(href)) {
      expect(declares, `${href} now renders its back link: remove it from PENDING_BACK_LINKS`).toBe(false);
    } else {
      expect(declares, `${href} must render <LearnInLesson item={requirePracticePage('${href}')} />`).toBe(true);
    }
  });

  it('lists pages in manifest order of their teaching lesson', () => {
    const pages = getPracticePages();
    expect(pages).toHaveLength(PRACTICE_PAGES.length);
    const orders = pages.map((page) => page.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    for (const page of pages) {
      expect(page.status).toBe('available');
      expect(page.lessons[0]?.order).toBe(page.order);
    }
  });

  it('keeps the teaching lesson first and related lessons in manifest order', () => {
    const coverage = requirePracticePage('/practice/visualizations/coverage-analyzer');
    expect(coverage.lessons.map((lesson) => lesson.ref)).toEqual([
      'I-SV-3A_Functional_Coverage_Fundamentals/index',
      'I-SV-3A_Functional_Coverage_Fundamentals/coverage-options',
      'I-SV-3B_Advanced_Functional_Coverage/closure-workflow',
    ]);
    const arbitration = getLessonsForPractice('/exercises/sequencer-arbitration');
    expect(arbitration[0].href).toBe(
      '/curriculum/T2_Intermediate/I-UVM-3B_Advanced_Sequencing_and_Layering/sequence-arbitration',
    );
    expect(arbitration[0].isModuleIndex).toBe(false);
  });

  it('fails loudly for an unmapped route', () => {
    expect(getPracticePage('/exercises/does-not-exist')).toBeUndefined();
    expect(getLessonsForPractice('/exercises/does-not-exist')).toEqual([]);
    expect(() => requirePracticePage('/exercises/does-not-exist')).toThrow(/PRACTICE_PAGES/);
  });
});

describe('labs', () => {
  it('only overrides real labs, and each override starts in the lab owningModule', () => {
    for (const [id, refs] of Object.entries(LAB_LESSON_OVERRIDES)) {
      const lab = getLabById(id);
      expect(lab, `override for unknown lab ${id}`).toBeDefined();
      expect(moduleCodeOf(refs[0].split('/')[0]), id).toBe(lab?.owningModule);
    }
  });

  it.each(availableLabs.map((lab) => [lab.id, lab] as const))(
    '%s belongs to a lesson that launches it',
    (_id, lab) => {
      const lessons = getLabLessons(lab);
      expect(lessons.length).toBeGreaterThan(0);
      const [launcher] = lessons;
      expectCanonical(launcher, lab.id);
      const source = lessonSource(launcher);
      expect(
        source.includes(`labId="${lab.id}"`) || source.includes(`/practice/lab/${lab.id}`),
        `${launcher.ref} does not link ${lab.id}; update LAB_LESSON_OVERRIDES in src/lib/practice-links.ts`,
      ).toBe(true);
      if (lab.moduleHref) expect(launcher.href, 'registry moduleHref disagrees with the practice map').toBe(lab.moduleHref);
    },
  );

  it('lists labs in manifest order, never links a lab that is not available, and drops archived labs', () => {
    const archived: LabManifest = { ...availableLabs[0], id: 'archived-example', status: 'archived' };
    const items = getPracticeLabItems([...getAllLabs(), archived]);
    expect(items.some((item) => item.id === 'lab:archived-example')).toBe(false);
    expect(items).toHaveLength(getAllLabs().filter((lab) => lab.status !== 'archived').length);
    const orders = items.map((item) => item.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    for (const item of items) {
      const lab = getLabById(item.id.replace(/^lab:/, ''));
      if (lab?.status === 'available') {
        expect(item.href).toBe(`/practice/lab/${lab.id}`);
      } else {
        expect(item.status).toBe('coming_soon');
        expect(item.href).toBeUndefined();
      }
    }
  });
});

describe('lab back link', () => {
  it.each(availableLabs.map((lab) => [lab.id, lab] as const))('%s goes back to its launching lesson', (_id, lab) => {
    const backLink = getLabBackLink(lab);
    const [launcher] = getLabLessons(lab);
    expect(backLink.href).toBe(launcher.href);
    expect(backLink.href).not.toBe('/curriculum');
    expect(backLink.lesson?.ref).toBe(launcher.ref);
    expect(backLink.label).toBe(launcher.isModuleIndex ? 'Back to module' : 'Back to lesson');
  });

  it('keeps the release-tested E-PSS-1 round trip', () => {
    const backLink = getLabBackLink(getLabById('pss-portable-intent') as LabManifest);
    expect(backLink).toMatchObject({
      href: '/curriculum/T4_Expert/E-PSS-1_Portable_Stimulus_Standard/index',
      label: 'Back to module',
    });
  });

  it('derives the module from owningModule when the registry has no moduleHref', () => {
    const basics = getLabById('basics-1') as LabManifest;
    expect(basics.moduleHref).toBeUndefined();
    expect(getLabBackLink(basics).href).toBe('/curriculum/T1_Foundational/F2D_Reusable_Code_and_Parallelism/index');
    expect(getLabBackLink({ id: 'example', owningModule: 'I-UVM-2C' }).href).toBe(
      '/curriculum/T2_Intermediate/I-UVM-2C_Configuration_and_Resources/index',
    );
    expect(
      getLabBackLink({
        id: 'example',
        owningModule: 'B-AHB-3',
        moduleHref: '/curriculum/T3_Advanced/B-AHB-3_AHB_Verification/index',
      }).href,
    ).toBe('/curriculum/T3_Advanced/B-AHB-3_AHB_Verification/index');
  });

  it('returns to the sub-lesson that launches the lab', () => {
    const backLink = getLabBackLink(getLabById('randomization-advanced-1') as LabManifest);
    expect(backLink.href).toBe('/curriculum/T2_Intermediate/I-SV-2B_Advanced_Constrained_Randomization/solver-debug');
    expect(backLink.label).toBe('Back to lesson');
  });

  it('falls back to the Practice Hub labs, not /curriculum, when the owning module does not exist', () => {
    expect(getLabBackLink({ id: 'example', owningModule: 'F4' })).toEqual({
      href: '/practice#labs',
      label: 'Back to the Practice Hub',
    });
  });
});

describe('lab prerequisites', () => {
  it('flags a lab prerequisite owned by a later module as "do this after" it (G30-PRAC-V04)', () => {
    // The deadlock lab no longer depends on the B-AXI-6 scoreboard lab (it never used it), so build the
    // forward case explicitly: a B-AXI-5 lab that needs the B-AXI-6 scoreboard lab.
    const deadlock = getLabById('axi-deadlock-hunt-lab') as LabManifest;
    const forwardCase = { ...deadlock, labPrerequisites: ['axi-scoreboard-lab'] } as LabManifest;
    const { items, doAfter } = getLabPrerequisites(forwardCase);
    expect(items).toEqual([
      expect.objectContaining({
        kind: 'lab',
        id: 'axi-scoreboard-lab',
        href: '/practice/lab/axi-scoreboard-lab',
        status: 'available',
        forward: true,
      }),
    ]);
    expect(doAfter?.href).toBe('/curriculum/T3_Advanced/B-AXI-6_AXI_Verification_Performance/index');
  });

  it('has no forward dependency left for the real B-AXI-5 deadlock lab', () => {
    const { items, doAfter } = getLabPrerequisites(getLabById('axi-deadlock-hunt-lab') as LabManifest);
    expect(items).toEqual([]);
    expect(doAfter).toBeUndefined();
  });

  it('links module prerequisites as lessons and skips the lab own module', () => {
    const { items, doAfter } = getLabPrerequisites(getLabById('pss-portable-intent') as LabManifest);
    expect(items).toEqual([
      expect.objectContaining({
        kind: 'lesson',
        id: 'I-UVM-3A',
        href: '/curriculum/T2_Intermediate/I-UVM-3A_Fundamentals/index',
        status: 'lesson',
        forward: false,
      }),
    ]);
    expect(doAfter).toBeUndefined();
  });

  it('accepts lab ids in modulePrerequisites and keeps labs that are not available as text', () => {
    const bridge = getLabPrerequisites(getLabById('ahb-axi-bridge-debug') as LabManifest);
    expect(bridge.items.map((item) => [item.kind, item.id, item.forward])).toEqual([
      ['lab', 'ahb-checker-lab', false],
      ['lab', 'axi-scoreboard-lab', false],
    ]);
    const config = getLabPrerequisites(getLabById('config-debug') as LabManifest);
    for (const item of config.items.filter((entry) => entry.status === 'coming_soon')) {
      expect(item.href).toBeUndefined();
    }
  });

  it('reports ids that name neither a lab nor a module instead of showing them', () => {
    const result = getLabPrerequisites({
      id: 'example',
      owningModule: 'I-SV-5',
      labPrerequisites: ['no-such-lab'],
      modulePrerequisites: ['NOT-A-MODULE', 'I-SV-5', 'F2D'],
    });
    expect(result.unresolved).toEqual(['no-such-lab', 'NOT-A-MODULE']);
    expect(result.items.map((item) => item.id)).toEqual(['F2D']);
  });

  it.each(availableLabs.map((lab) => [lab.id, lab] as const))('%s: every prerequisite link resolves', (_id, lab) => {
    const { items, doAfter } = getLabPrerequisites(lab);
    for (const item of items) {
      expect(item.id).not.toBe(lab.id);
      if (item.kind === 'lesson') expectCanonical(item.lesson, item.id);
      if (item.href?.startsWith('/practice/lab/')) {
        expect(getLabById(item.href.replace('/practice/lab/', ''))?.status).toBe('available');
      }
    }
    expect(Boolean(doAfter)).toBe(items.some((item) => item.forward && item.lesson));
  });
});

describe('reverse lookup for a lesson practice panel', () => {
  it('lists the practice a lesson teaches, in manifest order', () => {
    const entries = getPracticeForLesson('I-UVM-2A_Component_Roles/index', getAllLabs());
    const ids = entries.map((entry) => entry.item.id);
    expect(ids).toEqual(
      expect.arrayContaining(['exercise:uvm-agent-builder', 'diagram:uvm-component-relationships', 'lab:uvm-mini-capstone']),
    );
    expect(entries.find((entry) => entry.item.id === 'exercise:uvm-agent-builder')?.teaches).toBe(true);
    const capstone = entries.find((entry) => entry.item.id === 'lab:uvm-mini-capstone');
    expect(capstone?.teaches).toBe(false);
    expect(capstone?.after?.ref).toBe('A-UVM-6_Scoreboards_and_Reference_Models/index');
  });

  it('includes a lab only when labs are passed, and nothing for an unknown lesson', () => {
    expect(getPracticeForLesson('F2D_Reusable_Code_and_Parallelism/index').some((entry) => entry.item.kind === 'lab')).toBe(
      false,
    );
    expect(
      getPracticeForLesson('F2D_Reusable_Code_and_Parallelism/index', getAllLabs()).map((entry) => entry.item.id),
    ).toContain('lab:basics-1');
    expect(getPracticeForLesson('NOPE/index')).toEqual([]);
  });

  it('offers a sub-lesson the practice of its whole module (G30-PRAC-V05)', () => {
    const debug = getPracticeForModule(
      'E-DBG-1_Advanced_UVM_Debug_Methodologies',
      'E-DBG-1_Advanced_UVM_Debug_Methodologies/effective-debug',
      getAllLabs(),
    );
    expect(debug.map((entry) => entry.item.id)).toContain('lab:debug-waveform-trigger');
    expect(getPracticeForLesson('E-DBG-1_Advanced_UVM_Debug_Methodologies/effective-debug', getAllLabs())).toEqual([]);

    const arbitration = getPracticeForModule(
      'I-UVM-3B_Advanced_Sequencing_and_Layering',
      'I-UVM-3B_Advanced_Sequencing_and_Layering/sequencer-driver-handshake',
    );
    const sandbox = arbitration.find((entry) => entry.item.id === 'exercise:sequencer-arbitration');
    expect(sandbox?.teaches).toBe(false);
    expect(sandbox?.after?.ref).toBe('I-UVM-3B_Advanced_Sequencing_and_Layering/sequence-arbitration');
    expect(getPracticeForModule('NOPE')).toEqual([]);
  });
});
