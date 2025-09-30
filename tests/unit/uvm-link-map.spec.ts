import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { componentLinkMap, resolveComponentLink } from '@/components/diagrams/uvm-link-map';

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
      const mdxPath = path.join(curriculumRoot, `${relative}.mdx`);
      expect(fs.existsSync(mdxPath), `missing curriculum entry for ${id} at ${mdxPath}`).toBe(true);
    });
  });
});
