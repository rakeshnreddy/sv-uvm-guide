import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { generateCurriculumData } from '../../scripts/generate-curriculum-data';
import { lessonPracticeSections } from '../../src/lib/curriculum/lesson-mdx';
import { scanLessonHeadings } from '../../src/lib/expert-index';
import { getAllLabs } from '../../src/lib/lab-registry';
import { getPracticeForModule } from '../../src/lib/practice-links';

const repoRoot = process.cwd();
const contentRoot = path.join(repoRoot, 'content', 'curriculum');
const appRoot = path.join(repoRoot, 'src', 'app');

function walkFiles(dir: string, matcher: (filePath: string) => boolean): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const nextPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return walkFiles(nextPath, matcher);
    }
    return matcher(nextPath) ? [nextPath] : [];
  });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Every App Router page as its URL segments: route groups such as `(learning)`
 * and parallel-route slots are not part of the URL, so they are dropped.
 * `(learning)/practice/lab/[labId]/page.tsx` -> ['practice', 'lab', '[labId]'].
 */
function appPageRoutes(): string[][] {
  return walkFiles(appRoot, (filePath) => filePath.endsWith(`${path.sep}page.tsx`)).map((filePath) =>
    path
      .relative(appRoot, filePath)
      .replace(/\\/g, '/')
      .split('/')
      .slice(0, -1)
      .filter((segment) => !/^\(.+\)$/.test(segment) && !segment.startsWith('@')),
  );
}

const isDynamicSegment = (segment: string) => /^\[.+\]$/.test(segment);

/** Static pages beside the lesson catch-all, such as /curriculum/expert-index (NB2 request 4). */
function buildStaticCurriculumPages(): string[] {
  return appPageRoutes()
    .filter((segments) => segments[0] === 'curriculum' && segments.length > 1 && !segments.some(isDynamicSegment))
    .map((segments) => `/${segments.join('/')}`);
}

function buildCurriculumRoutes(): Set<string> {
  const routes = new Set<string>(['/curriculum', ...buildStaticCurriculumPages()]);
  const data = generateCurriculumData();

  data.forEach((courseModule) => {
    routes.add(`/curriculum/${courseModule.slug}`);
    courseModule.sections.forEach((section) => {
      routes.add(`/curriculum/${courseModule.slug}/${section.slug}`);
      section.topics.forEach((topic) => {
        routes.add(`/curriculum/${courseModule.slug}/${section.slug}/${topic.slug}`);
      });
    });
  });

  return routes;
}

function buildAppRoutePatterns(): RegExp[] {
  return appPageRoutes()
    .filter((segments) => segments[0] !== 'curriculum')
    .map((route) => {
      if (route.length === 0) {
        return /^\/$/;
      }

      const segments = route.map((segment) => {
        if (/^\[\[\.\.\.[^\]]+\]\]$/.test(segment)) {
          return '(?:/[^/]+)*';
        }
        if (/^\[\.\.\.[^\]]+\]$/.test(segment)) {
          return '(?:/[^/]+)+';
        }
        if (/^\[[^\]]+\]$/.test(segment)) {
          return '/[^/]+';
        }
        return `/${escapeRegExp(segment)}`;
      });

      return new RegExp(`^${segments.join('')}$`);
    });
}

function collectInternalLinks(filePath: string): string[] {
  const source = fs.readFileSync(filePath, 'utf8');
  const links = new Set<string>();

  for (const match of source.matchAll(/href\s*=\s*["'](\/[^"']+)["']/g)) {
    links.add(match[1]);
  }

  for (const match of source.matchAll(/\[[^\]]+\]\((\/[^)\s]+)\)/g)) {
    links.add(match[1]);
  }

  // TypeScript link maps (uvm-link-map.ts) hold curriculum routes as plain string literals.
  if (/\.tsx?$/.test(filePath)) {
    for (const match of source.matchAll(/["'`](\/curriculum\/[^"'`\s$]+)["'`]/g)) {
      links.add(match[1]);
    }
  }

  return Array.from(links);
}

function collectBrokenInternalLinks(): string[] {
  const curriculumRoutes = buildCurriculumRoutes();
  const appRoutePatterns = buildAppRoutePatterns();
  const filesToCheck = [
    ...walkFiles(contentRoot, (filePath) => filePath.endsWith('.mdx')),
    path.join(repoRoot, 'src', 'components', 'diagrams', 'verification-stack-links.ts'),
  ];
  const brokenLinks: string[] = [];

  filesToCheck.forEach((filePath) => {
    collectInternalLinks(filePath).forEach((href) => {
      const normalized = href.split('#')[0]?.split('?')[0] ?? href;

      if (normalized.length === 0) {
        return;
      }

      if (normalized === '/curriculum' || normalized.startsWith('/curriculum/')) {
        if (!curriculumRoutes.has(normalized)) {
          brokenLinks.push(`${path.relative(repoRoot, filePath)} -> ${normalized}`);
        }
        return;
      }

      if (!appRoutePatterns.some((pattern) => pattern.test(normalized))) {
        brokenLinks.push(`${path.relative(repoRoot, filePath)} -> ${normalized}`);
      }
    });
  });

  return brokenLinks;
}

function collectCustomMdxTags(): Set<string> {
  const tags = new Set<string>();
  const mdxFiles = walkFiles(contentRoot, (filePath) => filePath.endsWith('.mdx'));

  mdxFiles.forEach((filePath) => {
    // Ignore fenced code and inline code spans: `<SFX>` inside backticks is literal text, not a tag.
    const source = fs
      .readFileSync(filePath, 'utf8')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/``[^\n]*?``|`[^`\n]*`/g, '');

    for (const match of source.matchAll(/<([A-Z][A-Za-z0-9]*)\b/g)) {
      tags.add(match[1]);
    }
  });

  return tags;
}

function collectRegisteredMdxComponents(): Set<string> {
  const registryPath = path.join(repoRoot, 'src', 'generated', 'mdx-component-registry.tsx');
  const lazyRegistryPath = path.join(
    repoRoot,
    'src',
    'components',
    'mdx',
    'lazy-mdx-interactives.ts',
  );
  const source = fs.readFileSync(registryPath, 'utf8');
  const lazySource = fs.readFileSync(lazyRegistryPath, 'utf8');
  const componentsBlock = source.match(/export const mdxComponents = \{([\s\S]*?)\n};/);

  if (!componentsBlock) {
    throw new Error('Generated curriculum registry should define an MDX components map');
  }

  const registered = new Set<string>();

  componentsBlock[1].split('\n').forEach((line) => {
    const match = line.match(/^\s*([A-Z][A-Za-z0-9]*)\s*(?::|,)/);
    if (match) {
      registered.add(match[1]);
    }
  });

  for (const match of lazySource.matchAll(/^\s*"([A-Z][A-Za-z0-9]*)",$/gm)) {
    registered.add(match[1]);
  }

  return registered;
}

function resolveCurriculumRouteToFilePath(route: string): string | null {
  const normalized = route.replace(/^\/curriculum\/?/, '').replace(/\/$/, '');
  const segments = normalized.split('/').filter(Boolean);

  if (segments.length === 2) {
    return path.join(contentRoot, segments[0], segments[1], 'index.mdx');
  }

  if (segments.length === 3) {
    return path.join(contentRoot, segments[0], segments[1], `${segments[2]}.mdx`);
  }

  return null;
}

/**
 * The anchors a lesson page renders. Heading ids come from scanLessonHeadings
 * (src/lib/expert-index.ts): one createSlugger() from src/lib/heading-slug.ts
 * per page, fed every heading in document order, exactly as the lesson page's
 * remark-heading-ids plugin does (tests/lib/expert-index.test.ts holds the two
 * equal). So "#practice--reinforce" and repeated-heading suffixes such as
 * "-1" resolve as they do in the browser (NB1 request). The practice block's
 * own headings and explicit id="…" attributes count too.
 */
function collectDefinedAnchors(filePath: string): Set<string> {
  const source = fs.readFileSync(filePath, 'utf8');
  const { content, data } = matter(source);
  const anchors = new Set<string>(scanLessonHeadings(content).headings.map((heading) => heading.anchor));

  const [moduleSlug, lessonSlug] = path.relative(contentRoot, filePath).replace(/\\/g, '/').replace(/\.mdx$/, '').split('/').slice(1);
  const hasFlashcards = Boolean(data.flashcards ?? data.flashcardId);
  const hasHandsOn = getPracticeForModule(moduleSlug, `${moduleSlug}/${lessonSlug}`, getAllLabs()).length > 0;
  for (const section of lessonPracticeSections(hasFlashcards, hasHandsOn)) {
    anchors.add(section.id);
  }

  for (const match of source.matchAll(/\bid=["']([^"']+)["']/g)) {
    anchors.add(match[1]);
  }

  return anchors;
}

function collectBrokenCurriculumAnchors(): string[] {
  const filesToCheck = [
    ...walkFiles(contentRoot, (filePath) => filePath.endsWith('.mdx')),
    path.join(repoRoot, 'src', 'components', 'diagrams', 'uvm-link-map.ts'),
    path.join(repoRoot, 'src', 'components', 'home', 'InteractiveFeaturesSection.tsx'),
  ];
  const brokenAnchors: string[] = [];

  filesToCheck.forEach((filePath) => {
    collectInternalLinks(filePath).forEach((href) => {
      if (!href.startsWith('/curriculum/') || !href.includes('#')) {
        return;
      }

      const [route, rawHash] = href.split('#');
      const anchor = rawHash?.trim();

      if (!route || !anchor) {
        return;
      }

      const targetPath = resolveCurriculumRouteToFilePath(route);
      if (!targetPath || !fs.existsSync(targetPath)) {
        return;
      }

      const targetAnchors = collectDefinedAnchors(targetPath);
      if (!targetAnchors.has(anchor)) {
        brokenAnchors.push(`${path.relative(repoRoot, filePath)} -> ${href}`);
      }
    });
  });

  return brokenAnchors;
}

describe('Curriculum coverage audit', () => {
  it('gives every curriculum section a stable landing lesson and titled chapters', () => {
    const data = generateCurriculumData();

    expect(data.length).toBeGreaterThan(0);

    data.forEach((courseModule) => {
      expect(courseModule.sections.length, `${courseModule.slug} should expose at least one section`).toBeGreaterThan(0);

      courseModule.sections.forEach((section) => {
        expect(section.topics.length, `${courseModule.slug}/${section.slug} should expose at least one topic`).toBeGreaterThan(0);
        expect(
          section.topics.some((topic) => topic.slug === 'index'),
          `${courseModule.slug}/${section.slug} should keep an index landing lesson`,
        ).toBe(true);

        section.topics.forEach((topic) => {
          expect(topic.title, `${courseModule.slug}/${section.slug}/${topic.slug} should have a title`).toBeTruthy();
          expect(topic.description, `${courseModule.slug}/${section.slug}/${topic.slug} should have a description`).toBeTruthy();
        });
      });
    });
  });

  it('can enumerate authored coursework links for QA auditing', () => {
    const filesToCheck = walkFiles(contentRoot, (filePath) => filePath.endsWith('.mdx'));
    const internalLinkCount = filesToCheck.reduce((count, filePath) => count + collectInternalLinks(filePath).length, 0);

    expect(filesToCheck.length).toBeGreaterThan(0);
    expect(internalLinkCount).toBeGreaterThan(0);
  });

  it('accepts static pages under /curriculum, such as the expert index, as curriculum routes', () => {
    const staticPages = buildStaticCurriculumPages();
    expect(staticPages).toContain('/curriculum/expert-index');
    expect(staticPages.every((route) => !route.includes('['))).toBe(true);
    const curriculumRoutes = buildCurriculumRoutes();
    for (const route of staticPages) expect(curriculumRoutes.has(route), route).toBe(true);
  });

  it('matches app routes inside route groups, so the strict link audit sees /practice and friends', () => {
    const patterns = buildAppRoutePatterns();
    for (const route of ['/', '/practice', '/practice/lab/basics-1', '/exercises/uvm-phase-sorter', '/interview-prep', '/quiz/placement']) {
      expect(patterns.some((pattern) => pattern.test(route)), route).toBe(true);
    }
    expect(patterns.some((pattern) => pattern.test('/curriculum/expert-index'))).toBe(false);
    expect(patterns.some((pattern) => pattern.test('/no-such-page'))).toBe(false);
  });

  it('reads lesson anchors with the lesson page\'s slugger, so "--" and repeat suffixes resolve', () => {
    const anchors = collectDefinedAnchors(path.join(contentRoot, 'T2_Intermediate', 'I-UVM-3A_Fundamentals', 'index.mdx'));
    expect(anchors.has('the-handshake-sequence--sequencer--driver')).toBe(true);
    expect(anchors.has('practice--reinforce')).toBe(true);
    expect(anchors.has('the-handshake-sequence-sequencer-driver')).toBe(false);
    expect(anchors.has('teach-it-back')).toBe(true);
    // The anchor audit reads the diagram link map's string literals, not only href="…" attributes.
    const mapLinks = collectInternalLinks(path.join(repoRoot, 'src', 'components', 'diagrams', 'uvm-link-map.ts'));
    expect(mapLinks).toContain('/curriculum/T2_Intermediate/I-UVM-3A_Fundamentals/index#the-handshake-sequence--sequencer--driver');
  });

  it('keeps hard-coded curriculum routes in Playwright specs aligned with current lesson paths', () => {
    const curriculumRoutes = buildCurriculumRoutes();
    const e2eFiles = walkFiles(path.join(repoRoot, 'tests', 'e2e'), (filePath) => filePath.endsWith('.spec.ts'));

    e2eFiles.forEach((filePath) => {
      const source = fs.readFileSync(filePath, 'utf8');

      for (const match of source.matchAll(/["'](\/curriculum\/[A-Za-z0-9_/-]+)\/?["']/g)) {
        const route = match[1].replace(/\/$/, '');
        expect(curriculumRoutes.has(route), `${path.relative(repoRoot, filePath)} references removed curriculum route ${route}`).toBe(true);
      }
    });
  });

  it('keeps hard-coded curriculum routes in UI fallbacks aligned with current lesson paths', () => {
    const curriculumRoutes = buildCurriculumRoutes();

    const expectedFallbackRoutes = [
      '/curriculum/T2_Intermediate/I-UVM-3B_Advanced_Sequencing_and_Layering',
      '/curriculum/T2_Intermediate/I-UVM-1B_The_UVM_Factory',
      '/curriculum/T3_Advanced/A-UVM-4A_RAL_Fundamentals',
      '/curriculum/T2_Intermediate/I-UVM-1A_Components/index',
      '/curriculum/T2_Intermediate/I-UVM-3B_Advanced_Sequencing_and_Layering/sequence-arbitration',
      '/curriculum/T2_Intermediate/I-SV-4A_SVA_Fundamentals/index',
      '/curriculum/T3_Advanced/A-UVM-4A_RAL_Fundamentals/index',
    ];

    expectedFallbackRoutes.forEach(route => {
      expect(curriculumRoutes.has(route), `Fallback UI route ${route} must exist in the curriculum`).toBe(true);
    });
  });

  it('registers every custom MDX component tag used in curriculum content', () => {
    const usedTags = collectCustomMdxTags();
    const registeredComponents = collectRegisteredMdxComponents();
    const missingRegistrations = Array.from(usedTags)
      .filter((tag) => !registeredComponents.has(tag))
      .sort();

    expect(missingRegistrations, `Missing MDX component registrations: ${missingRegistrations.join(', ')}`).toEqual([]);
  });

  it('keeps retained learner-facing practice routes discoverable from the practice hub', () => {
    // The hub renders every route in the practice map (src/lib/practice-links.ts) through getPracticePages().
    const practiceHubSource = fs.readFileSync(path.join(repoRoot, 'src', 'components', 'practice', 'PracticeHub.tsx'), 'utf8');
    const practiceMapSource = fs.readFileSync(path.join(repoRoot, 'src', 'lib', 'practice-links.ts'), 'utf8');
    expect(practiceHubSource).toContain('getPracticePages()');
    const navbarSource = fs.readFileSync(path.join(repoRoot, 'src', 'components', 'Navbar.tsx'), 'utf8');
    const sidebarSource = fs.readFileSync(path.join(repoRoot, 'src', 'components', 'layout', 'Sidebar.tsx'), 'utf8');
    const retainedPracticeRoutes = [
      '/practice/visualizations/randomization-explorer',
      '/practice/visualizations/assertion-builder',
      '/practice/visualizations/uvm-phasing',
      '/practice/visualizations/uvm-component-relationships',
      '/practice/visualizations/systemverilog-data-types',
      '/practice/visualizations/concurrency',
      '/practice/visualizations/procedural-blocks',
      '/practice/visualizations/coverage-analyzer',
      '/practice/visualizations/data-type-comparison',
      '/practice/visualizations/interface-signal-flow',
      '/practice/visualizations/state-machine-designer',
      '/exercises/uvm-agent-builder',
    ];

    retainedPracticeRoutes.forEach((route) => {
      expect(practiceMapSource).toContain(`href: '${route}'`);
    });

    expect(navbarSource).toContain('/practice');
    expect(sidebarSource).toContain('/practice');
  });

  const strictLinkAudit = process.env.QA_STRICT_LINK_AUDIT === '1';
  (strictLinkAudit ? it : it.skip)('has no broken authored coursework links in strict mode', () => {
    expect(collectBrokenInternalLinks()).toEqual([]);
  });

  const strictAnchorAudit = process.env.QA_STRICT_ANCHOR_AUDIT === '1';
  (strictAnchorAudit ? it : it.skip)('has no broken curriculum hash anchors in strict mode', () => {
    expect(collectBrokenCurriculumAnchors()).toEqual([]);
  });
});
