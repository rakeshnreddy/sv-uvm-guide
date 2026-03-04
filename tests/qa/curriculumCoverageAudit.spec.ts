import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { generateCurriculumData } from '../../scripts/generate-curriculum-data';

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

function buildCurriculumRoutes(): Set<string> {
  const routes = new Set<string>(['/curriculum']);
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
  const pageFiles = walkFiles(appRoot, (filePath) => filePath.endsWith(`${path.sep}page.tsx`));

  return pageFiles
    .map((filePath) => path.relative(appRoot, filePath).replace(/\\/g, '/').replace(/\/page\.tsx$/, ''))
    .filter((route) => !route.startsWith('curriculum'))
    .map((route) => {
      if (route.length === 0) {
        return /^\/$/;
      }

      const segments = route.split('/').map((segment) => {
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

function slugifyHeading(value: string): string {
  return value
    .trim()
    .replace(/\{#.+\}$/, '')
    .replace(/`/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z]+;/gi, '')
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function collectCustomMdxTags(): Set<string> {
  const tags = new Set<string>();
  const mdxFiles = walkFiles(contentRoot, (filePath) => filePath.endsWith('.mdx'));

  mdxFiles.forEach((filePath) => {
    const source = fs.readFileSync(filePath, 'utf8').replace(/```[\s\S]*?```/g, '');

    for (const match of source.matchAll(/<([A-Z][A-Za-z0-9]*)\b/g)) {
      tags.add(match[1]);
    }
  });

  return tags;
}

function collectRegisteredMdxComponents(): Set<string> {
  const rendererPath = path.join(appRoot, 'curriculum', '[...slug]', 'page.tsx');
  const source = fs.readFileSync(rendererPath, 'utf8');
  const componentsBlock = source.match(/const components = \{([\s\S]*?)\n};/);

  if (!componentsBlock) {
    throw new Error('Curriculum topic renderer should define an MDX components map');
  }

  const registered = new Set<string>();

  componentsBlock[1].split('\n').forEach((line) => {
    const match = line.match(/^\s*([A-Z][A-Za-z0-9]*)\s*(?::|,)/);
    if (match) {
      registered.add(match[1]);
    }
  });

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

function collectDefinedAnchors(filePath: string): Set<string> {
  const source = fs.readFileSync(filePath, 'utf8');
  const anchors = new Set<string>();

  for (const match of source.matchAll(/^#{2,6}\s+(.+)$/gm)) {
    anchors.add(slugifyHeading(match[1]));
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
    const practiceHubSource = fs.readFileSync(path.join(repoRoot, 'src', 'components', 'practice', 'PracticeHub.tsx'), 'utf8');
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
      expect(practiceHubSource).toContain(route);
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
