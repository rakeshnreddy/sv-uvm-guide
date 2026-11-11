import { describe, expect, it } from 'vitest';

import { getAllLabs } from '@/lib/lab-registry';
import {
  PRACTICE_KIND_SECTION,
  PRACTICE_PAGES,
  SECTION_TITLES_OUTSIDE_NAV,
  getPracticeLabItems,
  getPracticePager,
  getPracticePages,
  pagerNeighbours,
  practiceBreadcrumbs,
  practiceRootLink,
  practiceSectionLink,
  requirePracticePager,
  type PracticeItem,
} from '@/lib/practice-links';
import { PRACTICE_SECTION_HREF, PRACTICE_SECTION_ID, type PracticeSection } from '@/lib/site-links';

function item(id: string, href?: string): PracticeItem {
  return {
    id,
    kind: 'exercise',
    title: `Title ${id}`,
    description: '',
    href,
    status: href ? 'available' : 'coming_soon',
    lessons: [],
    order: 0,
  };
}

const ITEMS = [item('a', '/a'), item('b', '/b'), item('c', '/c')];

describe('pagerNeighbours', () => {
  it('gives the first item only a next link', () => {
    const { prev, next } = pagerNeighbours(ITEMS, 'a');
    expect(prev).toBeUndefined();
    expect(next).toEqual({ title: 'Title b', href: '/b', lesson: undefined });
  });

  it('gives a middle item both neighbours', () => {
    const { prev, next } = pagerNeighbours(ITEMS, 'b');
    expect(prev?.href).toBe('/a');
    expect(next?.href).toBe('/c');
  });

  it('gives the last item only a previous link', () => {
    const { prev, next } = pagerNeighbours(ITEMS, 'c');
    expect(prev?.href).toBe('/b');
    expect(next).toBeUndefined();
  });

  it('skips items that cannot be opened, and returns nothing for an unknown id', () => {
    const withPlanned = [item('a', '/a'), item('planned'), item('c', '/c')];
    expect(pagerNeighbours(withPlanned, 'a').next?.href).toBe('/c');
    expect(pagerNeighbours(withPlanned, 'c').prev?.href).toBe('/a');
    expect(pagerNeighbours(ITEMS, 'missing')).toEqual({});
  });
});

describe('practice sections', () => {
  it('uses the ids and hrefs site-links.ts exports for every section', () => {
    for (const section of Object.keys(PRACTICE_SECTION_ID) as PracticeSection[]) {
      const link = practiceSectionLink(section);
      expect(link.id).toBe(PRACTICE_SECTION_ID[section]);
      expect(link.href).toBe(PRACTICE_SECTION_HREF[section]);
      expect(link.label).toMatch(/^[A-Z][a-z ]+$/);
    }
    expect(practiceSectionLink('interactiveModels').label).toBe('Interactive models');
  });

  it('takes Labs, Exercises and Interactive models from the nav config, with no hand-typed fallback', () => {
    for (const section of ['labs', 'exercises', 'interactiveModels'] as const) {
      expect(SECTION_TITLES_OUTSIDE_NAV[section], section).toBeUndefined();
    }
    expect(Object.keys(SECTION_TITLES_OUTSIDE_NAV).sort()).toEqual(['charts', 'diagrams', 'interviewPrep', 'tools']);
    expect(practiceSectionLink('labs', [{ label: 'Hands-on labs', href: '/practice#labs' }]).label).toBe('Hands-on labs');
  });

  it('throws when neither the nav config nor the fallbacks name a section', () => {
    expect(() => practiceSectionLink('labs', [], {})).toThrow(/practice section labs .* has no label/);
    expect(practiceSectionLink('diagrams', [], { diagrams: 'Diagrams' }).label).toBe('Diagrams');
  });

  it('maps every practice kind to a section', () => {
    for (const page of PRACTICE_PAGES) expect(PRACTICE_KIND_SECTION[page.kind]).toBeDefined();
    expect(PRACTICE_KIND_SECTION.lab).toBe('labs');
  });
});

describe('practiceBreadcrumbs', () => {
  it('is Practice, the section on /practice, then the item as the current page', () => {
    expect(practiceRootLink()).toEqual({ label: 'Practice', href: '/practice' });
    expect(practiceBreadcrumbs({ title: 'UVM phase sorter', kind: 'exercise' })).toEqual([
      { label: 'Practice', href: '/practice' },
      { label: 'Exercises', href: '/practice#exercises' },
      { label: 'UVM phase sorter' },
    ]);
    expect(practiceBreadcrumbs({ title: 'Waveform studio', kind: 'tool' })[1]).toEqual({
      label: 'Tools',
      href: '/practice#tools',
    });
  });
});

describe('getPracticePager', () => {
  it('pages through exercises in curriculum order, within the same kind', () => {
    const exercises = getPracticePages().filter((page) => page.kind === 'exercise');
    expect(exercises.length).toBeGreaterThan(2);
    const first = requirePracticePager(exercises[0].href!);
    expect(first.kind).toBe('exercise');
    expect(first.section).toEqual(practiceSectionLink('exercises'));
    expect(first.prev).toBeUndefined();
    expect(first.next?.href).toBe(exercises[1].href);
    expect(first.next?.lesson?.code).toBe(exercises[1].lessons[0].code);

    const middle = requirePracticePager(exercises[1].href!);
    expect(middle.prev?.href).toBe(exercises[0].href);
    expect(middle.next?.href).toBe(exercises[2].href);

    const last = requirePracticePager(exercises[exercises.length - 1].href!);
    expect(last.next).toBeUndefined();
  });

  it('never crosses into another kind', () => {
    for (const page of getPracticePages()) {
      const pager = requirePracticePager(page.href!);
      const sameKind = new Set(getPracticePages().filter((entry) => entry.kind === page.kind).map((entry) => entry.href));
      for (const neighbour of [pager.prev, pager.next]) if (neighbour) expect(sameKind.has(neighbour.href)).toBe(true);
    }
  });

  it('gives a one-item kind only the back link', () => {
    const tools = getPracticePages().filter((page) => page.kind === 'tool');
    if (tools.length !== 1) return;
    const pager = requirePracticePager(tools[0].href!);
    expect(pager.prev).toBeUndefined();
    expect(pager.next).toBeUndefined();
    expect(pager.section.href).toBe('/practice#tools');
  });

  it('pages labs among available labs in curriculum order', () => {
    const labs = getPracticeLabItems(getAllLabs()).filter((lab) => lab.href);
    expect(labs.length).toBeGreaterThan(2);
    const pager = requirePracticePager(labs[1].href!);
    expect(pager.kind).toBe('lab');
    expect(pager.section.href).toBe('/practice#labs');
    expect(pager.prev?.href).toBe(labs[0].href);
    expect(pager.next?.href).toBe(labs[2].href);
    expect(requirePracticePager(labs[0].href!).prev).toBeUndefined();
    expect(requirePracticePager(labs[labs.length - 1].href!).next).toBeUndefined();
  });

  it('is undefined for routes that are not practice items', () => {
    expect(getPracticePager('/practice')).toBeUndefined();
    expect(getPracticePager('/practice/lab/no-such-lab')).toBeUndefined();
    expect(() => requirePracticePager('/nope')).toThrow(/No practice pager/);
  });
});
