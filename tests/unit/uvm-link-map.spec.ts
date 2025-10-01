import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { componentLinkMap, resolveComponentLink } from '@/components/diagrams/uvm-link-map';
import {
  verificationStackLinkSeeds,
  verificationStackLinks,
} from '@/components/diagrams/verification-stack-links';

describe('uvm-link-map', () => {
  it('exposes stable link lookups', () => {
    Object.entries(componentLinkMap).forEach(([id, link]) => {
      expect(resolveComponentLink(id)).toBe(link);
    });
  });

  it('maps to existing curriculum content', () => {
    const curriculumRoot = path.join(process.cwd(), 'content', 'curriculum');

    Object.entries(componentLinkMap).forEach(([id, link]) => {
      if (!link) {
        return;
      }

      expect(link.startsWith('/curriculum/'), `link for ${id} should target curriculum`).toBe(true);
      const relative = link.replace(/^\/curriculum\//, '');
      const [relativePath, fragment] = relative.split('#');
      const mdxPath = path.join(curriculumRoot, `${relativePath}.mdx`);
      expect(fs.existsSync(mdxPath), `missing curriculum entry for ${id} at ${mdxPath}`).toBe(true);

      if (fragment !== undefined) {
        expect(fragment.length > 0, `fragment for ${id} should not be empty`).toBe(true);
      }
    });
  });

  it('keeps verification stack quick links aligned with link-mapped curriculum', () => {
    const quickLinkById = new Map(verificationStackLinks.map(link => [link.id, link]));

    verificationStackLinkSeeds.forEach(seed => {
      const rendered = quickLinkById.get(seed.id);
      expect(rendered, `missing rendered quick link for ${seed.id}`).toBeDefined();

      expect(rendered?.href, `quick link ${seed.id} should resolve to a route`).not.toBe('#');

      if (seed.componentId) {
        const mapped = resolveComponentLink(seed.componentId);
        expect(mapped, `componentId ${seed.componentId} should resolve via link map`).toBeTruthy();
        expect(rendered?.href).toBe(mapped ?? undefined);
        expect(rendered?.href?.startsWith('/curriculum/')).toBe(true);
      }

      if (seed.href) {
        expect(rendered?.href).toBe(seed.href);
      }
    });
  });
});
