import { describe, expect, it } from 'vitest';

import { siteLabel, siteLink } from '@/lib/nav-labels';
import { DASHBOARD_HREF, PRACTICE_HREF, REVIEW_HREF, SETTINGS_HREF } from '@/lib/site-links';

describe('nav-labels', () => {
  it('returns the one label the navigation config gives a destination', () => {
    expect(siteLink(DASHBOARD_HREF)).toEqual({ label: 'Dashboard', href: '/dashboard' });
    expect(siteLabel(REVIEW_HREF)).toBe('Review');
    expect(siteLabel(SETTINGS_HREF)).toBe('Settings');
    expect(siteLabel('/history')).toBe('History');
  });

  it('prefers the menu label for /practice', () => {
    expect(siteLabel(PRACTICE_HREF)).toBe('Practice hub');
  });

  it('throws for a destination that is not in the config', () => {
    expect(() => siteLink('/exercises')).toThrow(/not a destination/);
  });
});
