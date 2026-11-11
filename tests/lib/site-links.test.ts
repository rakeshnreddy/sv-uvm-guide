import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

import manifest from '../../content/curriculum/curriculum.manifest.json';
import { tierAnchor } from '@/lib/curriculum-overview';
import { tierAnchorId } from '@/lib/curriculum/lesson-context';
import { headingSlug } from '@/lib/heading-slug';
import { getPracticePages, practiceSectionLink } from '@/lib/practice-links';
import {
  activeNavLabel,
  EXPERT_INDEX_HREF,
  FOOTER_NAV,
  INTERVIEW_PREP_HREF,
  isNavGroup,
  LABS_HREF,
  LEGAL_LINKS,
  PLACEMENT_QUIZ_HREF,
  PRACTICE_SECTION_HREF,
  PRACTICE_SECTION_ID,
  PRIMARY_NAV,
  PUBLIC_NAV,
  SITE_NAME,
  SITE_TITLE_DEFAULT,
  SITE_TITLE_TEMPLATE,
  START_HERE_HREF,
  TIER_LINKS,
  TIER_SECTION_ID,
  tierSectionHref,
  tierSectionId,
  type NavItem,
  type NavLink,
} from '@/lib/site-links';

const APP_DIR = path.resolve(__dirname, '../../src/app');

/** Every page route under src/app/<group>, as a URL pattern ("/practice/lab/[labId]"). */
function pageRoutes(group: string): string[] {
  const routes: string[] = [];
  const walk = (dir: string, segments: string[]) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        // Route groups and private folders do not add a URL segment; private folders hold no routes.
        if (entry.name.startsWith('_')) continue;
        const isGroup = /^\(.*\)$/.test(entry.name);
        walk(path.join(dir, entry.name), isGroup ? segments : [...segments, entry.name]);
      } else if (/^page\.(tsx|ts|jsx|js|mdx)$/.test(entry.name)) {
        routes.push(`/${segments.join('/')}`);
      }
    }
  };
  walk(path.join(APP_DIR, group), []);
  return routes.sort();
}

const LEARNING_ROUTES = pageRoutes('(learning)');
const PUBLIC_ROUTES = pageRoutes('(public)');
const ALL_ROUTES = [...LEARNING_ROUTES, ...PUBLIC_ROUTES];

function routeMatches(pattern: string, pathname: string): boolean {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = pathname.split('/').filter(Boolean);
  for (let index = 0; index < patternParts.length; index += 1) {
    const part = patternParts[index];
    if (/^\[\.\.\..+\]$/.test(part)) return pathParts.length > index;
    if (/^\[\[\.\.\..+\]\]$/.test(part)) return true;
    if (pathParts[index] === undefined) return false;
    if (/^\[.+\]$/.test(part)) continue;
    if (part !== pathParts[index]) return false;
  }
  return patternParts.length === pathParts.length;
}

function flatten(items: readonly NavItem[]): NavLink[] {
  return items.flatMap((item) => (isNavGroup(item) ? item.children : [item]));
}

const CONFIG_LINKS: NavLink[] = [
  ...flatten(PRIMARY_NAV),
  ...PUBLIC_NAV,
  ...FOOTER_NAV.flatMap((group) => group.children),
  ...LEGAL_LINKS,
];

const TIER_IDS: string[] = manifest.tiers.map((tier) => tier.id);

/** The section ids each page exports here. */
const SECTION_IDS: Record<string, string[]> = {
  '/practice': Object.values(PRACTICE_SECTION_ID),
  '/curriculum': [...TIER_IDS.map((id) => tierSectionId(id)), 'routes'],
};

describe('site name and titles', () => {
  it('uses one name in the default title and the template', () => {
    expect(SITE_NAME).toBe('SV/UVM Hub');
    expect(SITE_TITLE_DEFAULT).toBe('SV/UVM Hub: SystemVerilog, UVM and AMBA verification');
    expect(SITE_TITLE_TEMPLATE).toBe('%s | SV/UVM Hub');
    expect(SITE_TITLE_DEFAULT.startsWith(SITE_NAME)).toBe(true);
    expect(SITE_TITLE_TEMPLATE.endsWith(SITE_NAME)).toBe(true);
  });
});

describe('navigation config', () => {
  it('lists the five primary items in order, with the Practice and Reference groups', () => {
    expect(PRIMARY_NAV.map((item) => item.label)).toEqual(['Curriculum', 'Practice', 'Interview prep', 'Reference', 'Dashboard']);
    const [curriculum, practice, interview, reference, dashboard] = PRIMARY_NAV;
    expect(curriculum).toEqual({ label: 'Curriculum', href: '/curriculum' });
    expect(dashboard).toEqual({ label: 'Dashboard', href: '/dashboard' });
    expect(interview).toEqual({ label: 'Interview prep', href: INTERVIEW_PREP_HREF });
    expect(isNavGroup(practice) && practice.children.map((link) => link.label)).toEqual([
      'Practice hub',
      'Labs',
      'Exercises',
      'Interactive models',
      'Waveform studio',
    ]);
    expect(isNavGroup(reference) && reference.children.map((link) => link.label)).toEqual([
      'Knowledge hub',
      'Resources',
      'Projects',
      'Learning strategies',
      'History',
    ]);
    expect(CONFIG_LINKS.some((link) => /start here/i.test(link.label))).toBe(false);
  });

  it('points Labs, Exercises and Interactive models at their /practice sections, and Waveform studio at its page', () => {
    const practice = PRIMARY_NAV[1];
    if (!isNavGroup(practice)) throw new Error('Practice is a group');
    const byLabel = Object.fromEntries(practice.children.map((link) => [link.label, link.href]));
    expect(byLabel['Practice hub']).toBe('/practice');
    expect(byLabel.Labs).toBe('/practice#labs');
    expect(byLabel.Exercises).toBe('/practice#exercises');
    expect(byLabel['Interactive models']).toBe('/practice#interactive-models');
    expect(byLabel['Waveform studio']).toBe('/practice/waveform-studio');
  });

  it('has three public links', () => {
    expect(PUBLIC_NAV).toEqual([
      { label: 'Curriculum', href: '/curriculum' },
      { label: 'Practice', href: '/practice' },
      { label: 'Interview prep', href: '/interview-prep' },
    ]);
  });

  it('has four footer groups and two legal links', () => {
    expect(FOOTER_NAV.map((group) => group.label)).toEqual(['Learn', 'Practice', 'Your learning', 'Reference']);
    expect(FOOTER_NAV[0].children.map((link) => link.label)).toEqual([
      'Curriculum',
      ...manifest.tiers.map((tier) => tier.title),
      'Find your level',
      'Expert index',
    ]);
    expect(FOOTER_NAV[1].children.map((link) => link.label)).toEqual([
      'Practice hub',
      'Labs',
      'Exercises',
      'Interactive models',
      'Interview prep',
    ]);
    expect(FOOTER_NAV[2].children).toEqual([
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Review', href: '/dashboard/review' },
      { label: 'Notebook', href: '/dashboard/notebook' },
      { label: 'Self-assessment', href: '/assessment' },
      { label: 'Settings', href: '/settings' },
    ]);
    expect(FOOTER_NAV[3].children.map((link) => link.label)).toEqual([
      'Knowledge hub',
      'Resources',
      'Projects',
      'Learning strategies',
      'History',
    ]);
    expect(LEGAL_LINKS).toEqual([
      { label: 'Privacy policy', href: '/privacy-policy' },
      { label: 'Terms of service', href: '/terms-of-service' },
    ]);
  });

  it('takes Tier 1 to Tier 4 from the manifest, linking to their sections of /curriculum', () => {
    expect(TIER_LINKS).toHaveLength(4);
    expect(TIER_LINKS).toEqual(manifest.tiers.map((tier) => ({ label: tier.title, href: tierSectionHref(tier.id) })));
    expect(TIER_LINKS.map((link) => link.label)).toEqual(['Tier 1: Foundations', 'Tier 2: Intermediate', 'Tier 3: Advanced', 'Tier 4: Expert']);
    expect(TIER_LINKS.map((link) => link.href)).toEqual(['/curriculum#t1', '/curriculum#t2', '/curriculum#t3', '/curriculum#t4']);
  });

  it('gives each destination one label everywhere', () => {
    const labelsByHref = new Map<string, Set<string>>();
    for (const link of CONFIG_LINKS) {
      labelsByHref.set(link.href, (labelsByHref.get(link.href) ?? new Set()).add(link.label));
    }
    const conflicts = [...labelsByHref].filter(([href, labels]) => labels.size > 1 && href !== '/practice');
    expect(conflicts).toEqual([]);
    // "/practice" is "Practice hub" in menus and "Practice" in the public header, where it is the top-level item.
    expect([...labelsByHref.get('/practice')!].sort()).toEqual(['Practice', 'Practice hub']);
  });

  it('writes every label in sentence case', () => {
    const labels = [
      ...PRIMARY_NAV.map((item) => item.label),
      ...FOOTER_NAV.map((group) => group.label),
      ...CONFIG_LINKS.map((link) => link.label),
    ];
    const ALLOWED_CAPITALS = new Set(['Tier', 'UVM', 'SystemVerilog', 'AMBA', 'AXI', 'APB', 'AHB']);
    for (const label of labels) {
      expect(label[0], label).toMatch(/[A-Z0-9]/);
      const words = label.split(/\s+/);
      words.slice(1).forEach((word, index) => {
        const afterColon = words[index].endsWith(':');
        if (afterColon || ALLOWED_CAPITALS.has(word) || /^[0-9]/.test(word)) return;
        expect(word[0], `"${word}" in "${label}"`).toMatch(/[^A-Z]/);
      });
    }
  });
});

describe('every href resolves', () => {
  it('to a page route under src/app, and its hash to an exported section id', () => {
    const hrefs = [
      ...new Set([...CONFIG_LINKS.map((link) => link.href), START_HERE_HREF, LABS_HREF, PLACEMENT_QUIZ_HREF, EXPERT_INDEX_HREF, ...Object.values(PRACTICE_SECTION_HREF)]),
    ];
    for (const href of hrefs) {
      const [pathname, hash] = href.split('#');
      expect(ALL_ROUTES.some((route) => routeMatches(route, pathname)), `${href} has no page route`).toBe(true);
      if (hash !== undefined) {
        expect(SECTION_IDS[pathname], `${href}: no section ids exported for ${pathname}`).toBeDefined();
        expect(SECTION_IDS[pathname], `${href}: unknown section`).toContain(hash);
      }
    }
  });

  it('uses the tier section ids the curriculum page renders', () => {
    expect(TIER_SECTION_ID).toBe(tierSectionId);
    for (const id of TIER_IDS) {
      expect(tierSectionId(id)).toBe(tierAnchor(id));
      expect(tierSectionId(id)).toBe(tierAnchorId(id));
      expect(tierSectionHref(id)).toBe(`/curriculum#${tierAnchor(id)}`);
    }
    // TierSection renders <section id={sectionId}> with sectionId = tierSectionId(tier.id); the overview builds anchor from tierAnchor.
    const tierSection = fs.readFileSync(path.resolve(__dirname, '../../src/components/curriculum/TierSection.tsx'), 'utf8');
    expect(tierSection).toMatch(/<section\s+id=\{sectionId\}/);
    expect(tierSection).toMatch(/const sectionId = tierSectionId\(tier\.id\)/);
    const overview = fs.readFileSync(path.resolve(__dirname, '../../src/lib/curriculum-overview.ts'), 'utf8');
    expect(overview).toMatch(/anchor: tierAnchor\(tier\.slug\)/);
  });

  it('uses the section ids the Practice hub renders', () => {
    const hub = fs.readFileSync(path.resolve(__dirname, '../../src/components/practice/PracticeHub.tsx'), 'utf8');
    const titles: Record<keyof typeof PRACTICE_SECTION_ID, string> = {
      labs: 'Labs',
      exercises: 'Exercises',
      interactiveModels: 'Interactive models',
      diagrams: 'Diagrams',
      charts: 'Charts',
      tools: 'Tools',
      interviewPrep: 'Interview prep',
    };
    // The hub renders each section heading with id={section.id} from practiceSectionLink, which reads
    // PRACTICE_SECTION_ID; the ids are also the shared heading slugs of the section titles.
    expect(hub).toContain("practiceSectionLink('labs')");
    expect(hub).toContain("practiceSectionLink('interviewPrep')");
    expect(hub).toContain('practiceSectionLink(section.section)');
    for (const [key, title] of Object.entries(titles) as [keyof typeof PRACTICE_SECTION_ID, string][]) {
      expect(PRACTICE_SECTION_ID[key]).toBe(headingSlug(title));
      expect(PRACTICE_SECTION_HREF[key]).toBe(`/practice#${headingSlug(title)}`);
      expect(practiceSectionLink(key)).toEqual({ section: key, id: PRACTICE_SECTION_ID[key], label: title, href: PRACTICE_SECTION_HREF[key] });
      if (key !== 'labs' && key !== 'interviewPrep') expect(hub).toContain(`section: '${key}'`);
    }
    // Sections with no items are not rendered: each page section exported here has items today.
    const kinds = new Set(getPracticePages().map((page) => page.kind));
    for (const kind of ['exercise', 'interactive', 'diagram', 'chart', 'tool']) expect(kinds.has(kind as never), kind).toBe(true);
  });
});

describe('activeNavLabel', () => {
  it.each([
    ['/curriculum', 'Curriculum'],
    ['/curriculum/T1_Foundational/F1A_Intro/index', 'Curriculum'],
    ['/curriculum/expert-index', 'Curriculum'],
    ['/quiz/placement', 'Curriculum'],
    ['/quiz/placement/', 'Curriculum'],
    ['/practice', 'Practice'],
    ['/practice/lab/lab-1', 'Practice'],
    ['/practice/waveform-studio', 'Practice'],
    ['/exercises', 'Practice'],
    ['/exercises/uvm-phase-sorter', 'Practice'],
    ['/visualizations/systemverilog-3d', 'Practice'],
    ['/interview-prep', 'Interview prep'],
    ['/knowledge-hub', 'Reference'],
    ['/resources', 'Reference'],
    ['/projects', 'Reference'],
    ['/learning-strategies', 'Reference'],
    ['/history', 'Reference'],
    ['/dashboard', 'Dashboard'],
    ['/dashboard/review', 'Dashboard'],
    ['/dashboard/notebook', 'Dashboard'],
    ['/settings', 'Dashboard'],
    ['/assessment', 'Dashboard'],
    ['/practice/', 'Practice'],
    ['/practice?tab=labs#labs', 'Practice'],
  ] as const)('%s -> %s', (pathname, label) => {
    expect(activeNavLabel(pathname)).toBe(label);
  });

  it.each(['/', '/quiz', '/quiz/placementx', '/privacy-policy', '/terms-of-service', '/community', '/notifications', '/practiced', '/curriculum-old', '', null, undefined])(
    '%s -> null',
    (pathname) => {
      expect(activeNavLabel(pathname)).toBeNull();
    },
  );
});

/**
 * Pages that are deliberately absent from the navigation config. Each one
 * covers itself and the routes below it.
 */
const COVERAGE_ALLOWLIST: Record<string, string> = {
  '/': 'The landing page; the wordmark links to it.',
  '/exercises':
    'Exercises are reached from the Practice hub (/practice#exercises); /exercises redirects there in phase 2 and its item pages keep their URLs.',
  '/visualizations': 'The 3D data-type model is a practice item listed on the Practice hub; activeNavLabel marks it Practice.',
  '/community': 'Hidden behind SITE_FEATURES.community (answers 404 in this deploy); /community/test-page was deleted in phase 2.',
  '/notifications': 'Hidden behind SITE_FEATURES.accounts (answers 404 in this deploy).',
};

describe('route coverage', () => {
  it('finds the learning and public page routes', () => {
    expect(LEARNING_ROUTES).toContain('/curriculum');
    expect(LEARNING_ROUTES).toContain('/curriculum/[...slug]');
    expect(PUBLIC_ROUTES).toContain('/');
  });

  it('puts every page route in the config, below a route that is, or in the allowlist with a reason', () => {
    const configPaths = new Set(CONFIG_LINKS.map((link) => link.href.split('#')[0]));
    const isUnder = (route: string, base: string) => route === base || (base !== '/' && route.startsWith(`${base}/`));
    const uncovered = ALL_ROUTES.filter(
      (route) =>
        !configPaths.has(route) &&
        ![...configPaths].some((base) => isUnder(route, base)) &&
        !Object.keys(COVERAGE_ALLOWLIST).some((base) => isUnder(route, base)),
    );
    expect(uncovered).toEqual([]);
    for (const reason of Object.values(COVERAGE_ALLOWLIST)) expect(reason.length).toBeGreaterThan(20);
  });

  it('keeps the allowlist small and free of stale entries', () => {
    const configPaths = new Set(CONFIG_LINKS.map((link) => link.href.split('#')[0]));
    for (const base of Object.keys(COVERAGE_ALLOWLIST)) {
      expect(configPaths.has(base), `${base} is in the config; drop it from the allowlist`).toBe(false);
      expect(ALL_ROUTES.some((route) => route === base || route.startsWith(`${base}/`)), `${base} matches no route`).toBe(true);
    }
    expect(Object.keys(COVERAGE_ALLOWLIST).length).toBeLessThanOrEqual(6);
  });
});
