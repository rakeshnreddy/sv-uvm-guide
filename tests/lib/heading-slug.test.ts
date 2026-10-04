import { describe, expect, it } from 'vitest';
import { createSlugger, headingSlug, isExpertHeading } from '@/lib/heading-slug';

describe('heading slugs', () => {
  it('matches GitHub-style anchors', () => {
    expect(headingSlug('Quick Take')).toBe('quick-take');
    expect(headingSlug('Practice & Reinforce')).toBe('practice--reinforce');
    expect(headingSlug('Expert: `uvm_config_db` precedence at scale')).toBe('expert-uvm_config_db-precedence-at-scale');
    expect(headingSlug('Why `<=` matters')).toBe('why--matters');
  });

  it('numbers repeated headings within one page', () => {
    const slug = createSlugger();
    expect(slug('Example')).toBe('example');
    expect(slug('Example')).toBe('example-1');
    expect(slug('Example')).toBe('example-2');
    expect(slug('Other')).toBe('other');
  });

  it('recognises expert-layer headings', () => {
    expect(isExpertHeading('Expert: race-free sampling with #0 skews')).toBe(true);
    expect(isExpertHeading('Expert:')).toBe(false);
    expect(isExpertHeading('Expertise matters')).toBe(false);
  });
});
