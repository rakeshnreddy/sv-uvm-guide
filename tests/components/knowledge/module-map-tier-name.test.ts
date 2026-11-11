import { describe, expect, it } from 'vitest';

import { tierDisplayName } from '@/components/knowledge/ModuleMap';
import { TIER_NAMES } from '@/lib/knowledge-graph-engine';
import { TIER_LINKS } from '@/lib/site-links';

describe('tierDisplayName', () => {
  it('names each concept tier as the rest of the site does ("Tier 1: Foundations")', () => {
    expect(tierDisplayName('Foundational')).toMatch(/^Tier 1: /);
    expect(TIER_NAMES.map(tierDisplayName)).toEqual(TIER_LINKS.map((link) => link.label));
  });
});
