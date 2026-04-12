import { describe, expect, it } from 'vitest';
import { getAllLabs, getLabById, LAB_REGISTRY } from '@/lib/lab-registry';

describe('lab-registry utilities', () => {
  describe('getAllLabs', () => {
    it('returns all labs in the registry', () => {
      const allLabs = getAllLabs();
      const registryLabs = Object.values(LAB_REGISTRY);

      expect(allLabs).not.toHaveLength(0);
      expect(allLabs).toHaveLength(registryLabs.length);
      expect(allLabs).toEqual(expect.arrayContaining(registryLabs));
    });

    it('returns an array of lab metadata', () => {
      const allLabs = getAllLabs();
      expect(allLabs.length).toBeGreaterThan(0);

      const lab = allLabs[0];
      expect(lab).toHaveProperty('id');
      expect(lab).toHaveProperty('title');
      expect(lab).toHaveProperty('status');
    });
  });

  describe('getLabById', () => {
    it('returns the correct lab for a valid ID', () => {
      const labIds = Object.keys(LAB_REGISTRY);
      expect(labIds.length).toBeGreaterThan(0);

      const testId = labIds[0];
      const expectedLab = LAB_REGISTRY[testId];

      const result = getLabById(testId);
      expect(result).toEqual(expectedLab);
    });

    it('returns undefined for an invalid ID', () => {
      const result = getLabById('non-existent-lab-id');
      expect(result).toBeUndefined();
    });

    it('returns undefined for an empty string ID', () => {
      const result = getLabById('');
      expect(result).toBeUndefined();
    });
  });
});
