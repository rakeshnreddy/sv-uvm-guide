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

  const strictLinkAudit = process.env.QA_STRICT_LINK_AUDIT === '1';
  (strictLinkAudit ? it : it.skip)('has no broken authored coursework links in strict mode', () => {
    expect(collectBrokenInternalLinks()).toEqual([]);
  });
});
