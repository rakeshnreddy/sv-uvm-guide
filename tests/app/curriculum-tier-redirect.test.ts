import { describe, expect, it } from 'vitest';

import manifest from '../../content/curriculum/curriculum.manifest.json';
import { tierRedirectHref } from '@/app/(learning)/curriculum/[...slug]/tier-redirect';
import { tierSectionHref } from '@/lib/site-links';

describe('tierRedirectHref (SPEC "URLs": /curriculum/<Tier> goes to its section of /curriculum)', () => {
  it('sends every tier folder to its section', () => {
    for (const tier of manifest.tiers) {
      expect(tierRedirectHref([tier.id])).toBe(tierSectionHref(tier.id));
    }
    expect(tierRedirectHref(['T3_Advanced'])).toBe('/curriculum#t3');
  });

  it('accepts the other spellings of a tier and an encoded segment', () => {
    expect(tierRedirectHref(['t1-foundational'])).toBe('/curriculum#t1');
    expect(tierRedirectHref([encodeURIComponent('T2_Intermediate')])).toBe('/curriculum#t2');
  });

  it('leaves lessons, modules and unknown paths to the lesson route', () => {
    expect(tierRedirectHref(['T2_Intermediate', 'I-SV-5_Synchronization_and_IPC'])).toBeNull();
    expect(tierRedirectHref(['T2_Intermediate', 'I-SV-5_Synchronization_and_IPC', 'mailboxes'])).toBeNull();
    expect(tierRedirectHref(['does-not-exist'])).toBeNull();
    expect(tierRedirectHref([])).toBeNull();
    expect(tierRedirectHref(undefined)).toBeNull();
  });
});
