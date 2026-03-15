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
    const path = resolveCurriculumPath(['T2_Intermediate', 'I-SV-2A_Constrained_Randomization_Fundamentals']);
    expect(path).toMatch(/^\/curriculum\//);
    expect(path.endsWith('/index')).toBe(true);
  });

  it('resolves nested lesson slugs for Tier 2 sequences', () => {
    const path = resolveCurriculumPath(['T2_Intermediate', 'I-SV-2A_Constrained_Randomization_Fundamentals', 'constraint-blocks']);
    expect(path).toBe('/curriculum/T2_Intermediate/I-SV-2A_Constrained_Randomization_Fundamentals/constraint-blocks');
  });

  it('falls back gracefully when a slug cannot be resolved', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => { });
    expect(resolveCurriculumPath(['unknown'], '/fallback')).toBe('/fallback');
    expect(resolveCurriculumPath(['unknown'])).toBe('#');
    warn.mockRestore();
  });

  describe('getEntryPointSlug', () => {
    it('returns null for empty slugs', () => {
      expect(getEntryPointSlug([])).toBeNull();
    });

    it('returns a 3-segment slug when only a tier is provided', () => {
      const entryPoint = getEntryPointSlug(['T1_Foundational']);
      expect(entryPoint).toEqual(['T1_Foundational', 'F1A_The_Cost_of_Bugs', 'index']);
    });

    it('returns a 3-segment slug when tier and section are provided', () => {
      const entryPoint = getEntryPointSlug(['T1_Foundational', 'F2C_Procedural_Code_and_Flow_Control']);
      expect(entryPoint).toEqual(['T1_Foundational', 'F2C_Procedural_Code_and_Flow_Control', 'index']);
    });

    it('returns the same 3-segment slug when a full slug is provided', () => {
      const entryPoint = getEntryPointSlug(['T1_Foundational', 'F2C_Procedural_Code_and_Flow_Control', 'flow-control']);
      expect(entryPoint).toEqual(['T1_Foundational', 'F2C_Procedural_Code_and_Flow_Control', 'flow-control']);
    });

    it('slices slugs longer than 3 segments', () => {
      const entryPoint = getEntryPointSlug(['T1_Foundational', 'F2C_Procedural_Code_and_Flow_Control', 'flow-control', 'extra']);
      expect(entryPoint).toEqual(['T1_Foundational', 'F2C_Procedural_Code_and_Flow_Control', 'flow-control']);
    });

    it('returns null for invalid tier slugs', () => {
      expect(getEntryPointSlug(['Invalid_Tier'])).toBeNull();
    });

    it('returns null for invalid section slugs', () => {
      expect(getEntryPointSlug(['T1_Foundational', 'Invalid_Section'])).toBeNull();
    });
  });
});
