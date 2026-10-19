import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import * as labRegistry from '@/lib/lab-registry';
import {
  getAllLabs,
  getLabById,
  LAB_PROGRESS_NOTE,
  LAB_REGISTRY,
  labBadgeProps,
  labCheckSummary,
  labProgressNote,
} from '@/lib/lab-registry';

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
      expect(lab?.graderId).toBeUndefined();
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
      expect(lab?.graderId).toBeUndefined();
      expect(lab?.moduleHref).toBe('/curriculum/T4_Expert/E-PSS-1_Portable_Stimulus_Standard/index');
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

  describe('lab entry-point helpers', () => {
    it('no longer offers a sign-in check: labs open without an account', () => {
      expect('labRequiresSignIn' in labRegistry).toBe(false);
    });

    it('labProgressNote says where progress lives for available labs only', () => {
      expect(LAB_PROGRESS_NOTE).toBe('Your progress is saved in this browser.');
      for (const lab of getAllLabs()) {
        expect(labProgressNote(lab), lab.id).toBe(lab.status === 'available' ? LAB_PROGRESS_NOTE : null);
      }
    });

    it('labCheckSummary is auto-checked only for labs with a grader and a graded step', () => {
      for (const lab of getAllLabs()) {
        const autoChecked = Boolean(lab.graderId) && lab.steps.some((step) => step.completion === 'graded');
        expect(labCheckSummary(lab), lab.id).toBe(
          autoChecked ? 'Auto-checked steps (structural, in your browser)' : 'Self-checked steps: you mark each one complete',
        );
      }
      // The copy never promises a compile or a simulation.
      for (const lab of getAllLabs()) expect(labCheckSummary(lab)).not.toMatch(/compil|simulat|grad/i);
    });

    it('labBadgeProps passes the badge only plain, serializable lab facts', () => {
      const lab = getLabById('basics-1')!;
      const props = labBadgeProps(lab);
      expect(props).toEqual({
        labId: 'basics-1',
        version: lab.version,
        stepCount: lab.steps.length,
        title: lab.title,
        stepIds: lab.steps.map((step) => step.id),
      });
      expect(JSON.parse(JSON.stringify(props))).toEqual(props);
      for (const entry of getAllLabs()) expect(labBadgeProps(entry).stepCount, entry.id).toBe(entry.steps.length);
    });
  });
});
