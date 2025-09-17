import { describe, expect, it, vi } from 'vitest';
import { curriculumData, normalizeSlug } from '@/lib/curriculum-data';
import { getEntryPointSlug, resolveCurriculumPath } from '@/lib/curriculum-path';

function getTierSectionTopic(tierSlug: string) {
  const tier = curriculumData.find(module => module.slug === tierSlug);
  if (!tier || tier.sections.length === 0) {
    throw new Error(`Missing tier or sections for slug: ${tierSlug}`);
  }
  const section = tier.sections[0];
  if (section.topics.length === 0) {
    throw new Error(`Missing topics for section: ${section.slug}`);
  }
  return { tier, section, topic: section.topics[0] };
}

describe('curriculum slug utilities', () => {
  it('returns the first topic when only a tier is provided', () => {
    const { tier, section, topic } = getTierSectionTopic('T2_Intermediate');
    expect(normalizeSlug([tier.slug])).toEqual([tier.slug, section.slug, topic.slug]);
  });

  it('honors the section default when topic omitted', () => {
    const { tier, section, topic } = getTierSectionTopic('T3_Advanced');
    expect(normalizeSlug([tier.slug, section.slug])).toEqual([tier.slug, section.slug, topic.slug]);
  });

  it('keeps full topic slugs untouched', () => {
    const { tier, section, topic } = getTierSectionTopic('T1_Foundational');
    expect(normalizeSlug([tier.slug, section.slug, topic.slug])).toEqual([tier.slug, section.slug, topic.slug]);
  });

  it('maps to curriculum paths for UI surfaces', () => {
    const path = resolveCurriculumPath(['T3_Advanced', 'A-UVM-1_Advanced_Sequencing']);
    expect(path).toMatch(/^\/curriculum\//);
    expect(path.endsWith('/index')).toBe(true);
  });

  it('supports non-tier collections such as interactive tools', () => {
    const path = resolveCurriculumPath(['interactive-tools', 'uvm-visualizers']);
    expect(path).toBe('/curriculum/interactive-tools/uvm-visualizers/interactive-testbench');
  });

  it('falls back gracefully when a slug cannot be resolved', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(resolveCurriculumPath(['unknown'], '/fallback')).toBe('/fallback');
    expect(resolveCurriculumPath(['unknown'])).toBe('#');
    warn.mockRestore();
  });

  it('provides fully-qualified slugs for entry points', () => {
    const entryPoint = getEntryPointSlug(['T4_Expert', 'E-CUST-1_UVM_Methodology_Customization']);
    expect(entryPoint).toBeTruthy();
    expect(entryPoint?.length).toBe(3);
  });
});
