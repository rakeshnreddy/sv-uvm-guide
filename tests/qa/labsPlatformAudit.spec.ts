import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { getAllLabs } from '@/lib/lab-registry';

const repoRoot = process.cwd();
const curriculumRoot = path.join(repoRoot, 'content', 'curriculum');
const strictLabsAudit = process.env.QA_STRICT_LABS_AUDIT === '1';

function walkFiles(dir: string, extension: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const nextPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return walkFiles(nextPath, extension);
    }
    return nextPath.endsWith(extension) ? [nextPath] : [];
  });
}

function findReadmes(assetLocation: string): string[] {
  const assetPath = path.join(repoRoot, assetLocation);
  if (!fs.existsSync(assetPath)) {
    return [];
  }

  if (fs.statSync(assetPath).isFile()) {
    return path.basename(assetPath) === 'README.md' ? [assetPath] : [];
  }

  return walkFiles(assetPath, '.md').filter((filePath) => path.basename(filePath) === 'README.md');
}

describe('W8 labs platform audit', () => {
  it('keeps registered labs mapped to real asset locations with unique ids and route slugs', () => {
    const labs = getAllLabs();
    const seenIds = new Set<string>();
    const seenRouteSlugs = new Set<string>();

    labs.forEach((lab) => {
      expect(seenIds.has(lab.id), `duplicate lab id detected: ${lab.id}`).toBe(false);
      seenIds.add(lab.id);

      expect(
        seenRouteSlugs.has(lab.routeSlug),
        `duplicate lab route slug detected: ${lab.routeSlug}`,
      ).toBe(false);
      seenRouteSlugs.add(lab.routeSlug);

      const assetPath = path.join(repoRoot, lab.assetLocation);
      expect(fs.existsSync(assetPath), `asset path should exist for lab ${lab.id}: ${lab.assetLocation}`).toBe(true);
    });
  });

  it('keeps LabLink MDX usages on registered lab ids', () => {
    const mdxFiles = walkFiles(curriculumRoot, '.mdx');
    const registeredLabIds = new Set(getAllLabs().map((lab) => lab.id));
    const invalidLinks: string[] = [];

    mdxFiles.forEach((filePath) => {
      const source = fs.readFileSync(filePath, 'utf8');
      const labLinkTags = source.match(/<LabLink\b[\s\S]*?\/>/g) ?? [];

      labLinkTags.forEach((tag) => {
        const labId = tag.match(/\blabId=["']([^"']+)["']/)?.[1];
        const relativePath = path.relative(repoRoot, filePath);

        if (!labId) {
          invalidLinks.push(`${relativePath}: LabLink must use labId`);
          return;
        }

        if (!registeredLabIds.has(labId)) {
          invalidLinks.push(`${relativePath}: unknown labId ${labId}`);
        }
      });
    });

    expect(invalidLinks, `invalid LabLink usages: ${invalidLinks.join('; ')}`).toEqual([]);
  });

  (strictLabsAudit ? it : it.skip)(
    'makes every available lab discoverable from curriculum content through a stable link',
    () => {
      const mdxFiles = walkFiles(curriculumRoot, '.mdx');
      const missingInboundLinks = getAllLabs()
        .filter((lab) => lab.status === 'available')
        .map((lab) => {
          const hasLink = mdxFiles.some((filePath) => {
            const source = fs.readFileSync(filePath, 'utf8');
            return (
              source.includes(`/practice/lab/${lab.id}`) ||
              source.includes(`<LabLink labId="${lab.id}"`) ||
              source.includes(`<LabLink labId='${lab.id}'`) ||
              source.includes(`labId="${lab.id}"`) ||
              source.includes(`labId='${lab.id}'`)
            );
          });

          return hasLink ? null : lab.id;
        })
        .filter((labId): labId is string => Boolean(labId));

      expect(
        missingInboundLinks,
        `available labs should be linked from curriculum MDX via /practice/lab/<id> or <LabLink />, missing: ${missingInboundLinks.join(', ')}`,
      ).toEqual([]);
    },
  );

  (strictLabsAudit ? it : it.skip)(
    'keeps lab owning-module metadata aligned with module ids explicitly referenced in source lab READMEs',
    () => {
      const mismatches = getAllLabs().flatMap((lab) => {
        const readmes = findReadmes(lab.assetLocation);
        if (readmes.length !== 1) {
          return [];
        }

        const source = fs.readFileSync(readmes[0], 'utf8');
        const referencedModule = source.match(/\b(?:F\d[A-Z]?|I-[A-Z]+-\d[A-Z]?|E-[A-Z]+-\d[A-Z]?)\b/)?.[0];

        if (!referencedModule || referencedModule === lab.owningModule) {
          return [];
        }

        return [`${lab.id}: registry=${lab.owningModule}, readme=${referencedModule}, file=${path.relative(repoRoot, readmes[0])}`];
      });

      expect(
        mismatches,
        `lab registry metadata should not conflict with module ids called out in the canonical lab README: ${mismatches.join('; ')}`,
      ).toEqual([]);
    },
  );
});
