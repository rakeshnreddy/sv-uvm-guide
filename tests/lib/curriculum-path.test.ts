import { describe, expect, it, vi } from 'vitest';
import { resolveCurriculumPath, getEntryPointSlug } from '@/lib/curriculum-path';

describe('curriculum-path', () => {
  describe('resolveCurriculumPath', () => {
    it('resolves a full 3-segment slug to a curriculum path', () => {
      const slug = ['T1_Foundational', 'F2C_Procedural_Code_and_Flow_Control', 'flow-control'];
      const path = resolveCurriculumPath(slug);
      expect(path).toBe('/curriculum/T1_Foundational/F2C_Procedural_Code_and_Flow_Control/flow-control');
    });

    it('resolves a 2-segment slug by normalizing it', () => {
      const slug = ['T1_Foundational', 'F2C_Procedural_Code_and_Flow_Control'];
      const path = resolveCurriculumPath(slug);
      // F2C index topic has slug 'index'
      expect(path).toBe('/curriculum/T1_Foundational/F2C_Procedural_Code_and_Flow_Control/index');
    });

    it('resolves a 1-segment slug by normalizing it', () => {
      const slug = ['T1_Foundational'];
      const path = resolveCurriculumPath(slug);
      // T1 first section is F1A, first topic is index
      expect(path).toBe('/curriculum/T1_Foundational/F1A_The_Cost_of_Bugs/index');
    });

    it('returns fallback if provided and slug cannot be resolved', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => { });
      const slug = ['NonExistentTier'];
      const path = resolveCurriculumPath(slug, '/fallback');
      expect(path).toBe('/fallback');
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    it('returns "#" and warns in non-production if slug cannot be resolved and no fallback is provided', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => { });
      const slug = ['NonExistentTier'];
      const path = resolveCurriculumPath(slug);
      expect(path).toBe('#');
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });
  });

  describe('getEntryPointSlug', () => {
    it('returns a normalized 3-segment slug for valid input', () => {
      const slug = ['T1_Foundational'];
      const entryPoint = getEntryPointSlug(slug);
      expect(entryPoint).toEqual(['T1_Foundational', 'F1A_The_Cost_of_Bugs', 'index']);
    });

    it('returns the same slug if it is already a valid 3-segment slug', () => {
      const slug = ['T1_Foundational', 'F2C_Procedural_Code_and_Flow_Control', 'flow-control'];
      const entryPoint = getEntryPointSlug(slug);
      expect(entryPoint).toEqual(slug);
    });

    it('returns null for an invalid slug', () => {
      const slug = ['InvalidTier'];
      const entryPoint = getEntryPointSlug(slug);
      expect(entryPoint).toBeNull();
    });

    it('returns null for an empty slug', () => {
      const slug: string[] = [];
      const entryPoint = getEntryPointSlug(slug);
      expect(entryPoint).toBeNull();
    });
  });
});
