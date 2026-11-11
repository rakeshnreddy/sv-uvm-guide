import { describe, expect, it } from 'vitest';

import { currentChild, navLinkCurrent, sectionRouteMatch, topItemCurrent, yourLearningLinks } from '@/components/layout/nav-current';
import { FOOTER_NAV, NAV_SECTION_ROUTES, PRIMARY_NAV, isNavGroup, type NavGroup } from '@/lib/site-links';

const item = (label: string) => PRIMARY_NAV.find((entry) => entry.label === label)!;
const practice = item('Practice') as NavGroup;

describe('navLinkCurrent', () => {
  it('is "page" on the page, "true" below it, and never for a link to part of a page', () => {
    expect(navLinkCurrent('/practice', '/practice')).toBe('page');
    expect(navLinkCurrent('/practice/', '/practice')).toBe('page');
    expect(navLinkCurrent('/practice?tab=x', '/practice')).toBe('page');
    expect(navLinkCurrent('/practice/lab/x', '/practice')).toBe('true');
    expect(navLinkCurrent('/practices', '/practice')).toBeUndefined();
    expect(navLinkCurrent('/practice', '/practice#labs')).toBeUndefined();
    expect(navLinkCurrent(null, '/practice')).toBeUndefined();
  });
});

describe('topItemCurrent', () => {
  it('follows activeNavLabel: "page" on the item\'s own page, "true" elsewhere in its section', () => {
    expect(topItemCurrent('/curriculum', item('Curriculum'))).toBe('page');
    expect(topItemCurrent('/curriculum/T1_Foundational/F1A/index', item('Curriculum'))).toBe('true');
    expect(topItemCurrent('/settings', item('Dashboard'))).toBe('true');
    expect(topItemCurrent('/dashboard', item('Dashboard'))).toBe('page');
    expect(topItemCurrent('/visualizations/systemverilog-3d', practice)).toBe('true');
    expect(topItemCurrent('/practice', practice)).toBe('true');
    expect(topItemCurrent('/history', item('Reference'))).toBe('true');
    expect(topItemCurrent('/', item('Curriculum'))).toBeUndefined();
    expect(topItemCurrent('/practice', item('Curriculum'))).toBeUndefined();
  });
});

describe('currentChild', () => {
  it('marks the exact page, else the closest section, and at most one child', () => {
    expect(currentChild('/practice/waveform-studio', practice.children)).toEqual({ href: '/practice/waveform-studio', current: 'page' });
    expect(currentChild('/practice', practice.children)).toEqual({ href: '/practice', current: 'page' });
    expect(currentChild('/curriculum', practice.children)).toBeUndefined();
  });

  it.each([
    ['/practice/lab/basics-1', '/practice#labs'],
    ['/practice/lab/basics-1/', '/practice#labs'],
    ['/exercises/uvm-phase-sorter', '/practice#exercises'],
    ['/exercises', '/practice#exercises'],
    ['/practice/visualizations/uvm-phasing', '/practice#interactive-models'],
    ['/visualizations/systemverilog-3d', '/practice#interactive-models'],
  ])('marks the section a practice page belongs to: %s -> %s', (path, href) => {
    expect(currentChild(path, practice.children)).toEqual({ href, current: 'true' });
  });

  it('still falls back to the hub for a practice page no section claims', () => {
    expect(currentChild('/practice/something-else', practice.children)).toEqual({ href: '/practice', current: 'true' });
    expect(currentChild('/exercisesx', practice.children)).toBeUndefined();
  });

  it('prefers the longest section route when two match', () => {
    const routes = { '/practice#a': ['/practice'], '/practice#b': ['/practice/lab'] };
    const children = [
      { label: 'A', href: '/practice#a' },
      { label: 'B', href: '/practice#b' },
    ];
    expect(currentChild('/practice/lab/x', children, routes)).toEqual({ href: '/practice#b', current: 'true' });
  });
});

describe('sectionRouteMatch', () => {
  it('measures how closely a section link fits a path, 0 for none', () => {
    expect(sectionRouteMatch('/practice/lab/x', '/practice#labs')).toBe('/practice/lab'.length);
    expect(sectionRouteMatch('/practice/labs', '/practice#labs')).toBe(0);
    expect(sectionRouteMatch('/practice/waveform-studio', '/practice/waveform-studio')).toBe(0);
    expect(sectionRouteMatch(null, '/practice#labs')).toBe(0);
  });

  it('gives every hash child of the Practice menu its routes, and Waveform studio none', () => {
    expect(NAV_SECTION_ROUTES).toEqual({
      '/practice#labs': ['/practice/lab'],
      '/practice#exercises': ['/exercises'],
      '/practice#interactive-models': ['/practice/visualizations', '/visualizations'],
    });
    for (const child of practice.children.filter((link) => link.href.includes('#'))) {
      expect(NAV_SECTION_ROUTES[child.href], child.label).toBeDefined();
    }
  });
});

describe('yourLearningLinks', () => {
  it('is the footer\'s "Your learning" group without Dashboard', () => {
    const group = FOOTER_NAV.find((entry) => entry.label === 'Your learning')!;
    expect(yourLearningLinks()).toEqual(group.children.filter((link) => link.href !== '/dashboard'));
    expect(yourLearningLinks().map((link) => link.label)).toEqual(['Review', 'Notebook', 'Self-assessment', 'Settings']);
    expect(yourLearningLinks([])).toEqual([]);
  });

  it('never repeats a main destination', () => {
    const main = new Set(PRIMARY_NAV.flatMap((entry) => (isNavGroup(entry) ? entry.children : [entry])).map((link) => link.href));
    for (const link of yourLearningLinks()) expect(main.has(link.href)).toBe(false);
  });
});
