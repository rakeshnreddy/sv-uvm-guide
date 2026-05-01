import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { getAllLabs, getLabById, LAB_REGISTRY } from '@/lib/lab-registry';

const repoRoot = process.cwd();

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

  describe('capstone lab registration', () => {
    it('registers the UVM mini capstone with matching lab metadata and assets', () => {
      const lab = getLabById('uvm-mini-capstone');
      expect(lab).toBeDefined();
      expect(lab?.status).toBe('available');
      expect(lab?.graderType).toBe('uvm');
      expect(lab?.steps).toHaveLength(4);

      const assetPath = path.join(repoRoot, lab!.assetLocation);
      const metadataPath = path.join(assetPath, 'lab.json');
      const starterPath = path.join(assetPath, 'testbench.sv');
      const solutionPath = path.join(assetPath, 'solution.sv');

      expect(fs.existsSync(metadataPath)).toBe(true);
      expect(fs.existsSync(starterPath)).toBe(true);
      expect(fs.existsSync(solutionPath)).toBe(true);

      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      expect(metadata.id).toBe(lab?.id);
      expect(metadata.title).toBe(lab?.title);
    });

    it('registers the SoC strategy capstone with template, model answer, and rubric assets', () => {
      const lab = getLabById('soc-strategy-capstone');
      expect(lab).toBeDefined();
      expect(lab?.status).toBe('available');
      expect(lab?.owningModule).toBe('E-SOC-1');
      expect(lab?.steps).toHaveLength(4);

      const assetPath = path.join(repoRoot, lab!.assetLocation);
      const metadataPath = path.join(assetPath, 'lab.json');
      const templatePath = path.join(assetPath, 'strategy_template.md');
      const modelPath = path.join(assetPath, 'model_solution.md');
      const readmePath = path.join(assetPath, 'README.md');

      expect(fs.existsSync(metadataPath)).toBe(true);
      expect(fs.existsSync(templatePath)).toBe(true);
      expect(fs.existsSync(modelPath)).toBe(true);
      expect(fs.existsSync(readmePath)).toBe(true);

      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      expect(metadata.id).toBe(lab?.id);
      expect(metadata.description).toContain('formal/liveness');
    });

    it('registers the PSS portable intent lab with starter, solution, and generated target assets', () => {
      const lab = getLabById('pss-portable-intent');
      expect(lab).toBeDefined();
      expect(lab?.status).toBe('available');
      expect(lab?.owningModule).toBe('E-PSS-1');
      expect(lab?.graderType).toBe('custom');
      expect(lab?.steps).toHaveLength(3);

      const assetPath = path.join(repoRoot, lab!.assetLocation);
      const metadataPath = path.join(assetPath, 'lab.json');
      const readmePath = path.join(assetPath, 'README.md');
      const starterPath = path.join(assetPath, 'starter', 'mem_test.pss');
      const solutionPath = path.join(assetPath, 'solution', 'mem_test.pss');
      const generatedSvPath = path.join(assetPath, 'solution', 'generated_uvm_sequence.sv');
      const generatedCPath = path.join(assetPath, 'solution', 'generated_baremetal_test.c');

      expect(fs.existsSync(metadataPath)).toBe(true);
      expect(fs.existsSync(readmePath)).toBe(true);
      expect(fs.existsSync(starterPath)).toBe(true);
      expect(fs.existsSync(solutionPath)).toBe(true);
      expect(fs.existsSync(generatedSvPath)).toBe(true);
      expect(fs.existsSync(generatedCPath)).toBe(true);

      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      expect(metadata.id).toBe(lab?.id);
      expect(metadata.description).toContain('generated UVM sequence and C bare-metal');
    });
  });
});
