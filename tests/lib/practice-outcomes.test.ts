/*
 * Author-written outcome lines: the short clause a Practice hub row shows for
 * a lab (its manifest `outcome`), a practice page or an interview bank. The
 * validator (outcomeLineSchema, and the same rule in
 * scripts/generate-lab-registry.mjs) holds every line to one whole clause of
 * at most 110 characters with no ellipsis.
 */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadInterviewBanks } from '@/app/(learning)/interview-prep/interview-banks';
import { OUTCOME_LINE_MAX_CHARS, labManifestSchema, outcomeLineSchema } from '@/lib/lab-manifest';
import { getAllLabs } from '@/lib/lab-registry';
import { INTERVIEW_BANK_OUTCOMES, PRACTICE_PAGES, getPracticeLabItems } from '@/lib/practice-links';

const MODULE_CODE = /\b[FIABE]-[A-Z]+-[A-Z]?\d+[A-Z]?\b|\bF\d[A-Z]?\b/;

function expectReadableOutcome(id: string, outcome: string) {
  expect(outcomeLineSchema.safeParse(outcome).success, `${id}: ${outcome}`).toBe(true);
  // Sentence case: a capital first letter, and it ends like the rows that read well.
  expect(outcome.charAt(0), id).toMatch(/[A-Z]/);
  expect(outcome, id).toMatch(/[^.]\.$/);
}

describe('outcomeLineSchema', () => {
  it('accepts one whole clause up to the limit', () => {
    expect(OUTCOME_LINE_MAX_CHARS).toBe(110);
    expect(outcomeLineSchema.safeParse('Build a self-checking bench.').success).toBe(true);
    expect(outcomeLineSchema.safeParse(`${'x'.repeat(OUTCOME_LINE_MAX_CHARS - 1)}.`).success).toBe(true);
  });

  it('rejects a line over the limit, an ellipsis, padding and an empty line', () => {
    expect(outcomeLineSchema.safeParse('x'.repeat(OUTCOME_LINE_MAX_CHARS + 1)).success).toBe(false);
    expect(outcomeLineSchema.safeParse('Build a bench and…').success).toBe(false);
    expect(outcomeLineSchema.safeParse('Build a bench and...').success).toBe(false);
    expect(outcomeLineSchema.safeParse(' Build a bench.').success).toBe(false);
    expect(outcomeLineSchema.safeParse('').success).toBe(false);
  });

  it('is the rule the lab registry generator enforces too', () => {
    const generator = fs.readFileSync(path.join(process.cwd(), 'scripts', 'generate-lab-registry.mjs'), 'utf8');
    expect(generator).toContain(`const OUTCOME_LINE_MAX_CHARS = ${OUTCOME_LINE_MAX_CHARS};`);
    expect(generator).toMatch(/outcome: outcomeSchema\.optional\(\)/);
  });

  it('is an optional manifest field', () => {
    const [lab] = getAllLabs();
    const { assetLocation: _location, ...manifest } = lab;
    expect(labManifestSchema.safeParse(manifest).success).toBe(true);
    const { outcome: _outcome, ...withoutOutcome } = manifest;
    expect(labManifestSchema.safeParse(withoutOutcome).success).toBe(true);
    expect(labManifestSchema.safeParse({ ...manifest, outcome: 'Cut short…' }).success).toBe(false);
  });
});

describe('lab outcomes', () => {
  it('gives every lab a readable outcome without its module code', () => {
    const labs = getAllLabs();
    expect(labs).toHaveLength(30);
    for (const lab of labs) {
      expect(lab.outcome, lab.id).toBeDefined();
      const outcome = lab.outcome ?? '';
      expectReadableOutcome(lab.id, outcome);
      expect(outcome, lab.id).not.toContain(lab.owningModule);
      expect(outcome, lab.id).not.toMatch(MODULE_CODE);
    }
  });

  it('carries the outcome onto the lab practice item', () => {
    for (const item of getPracticeLabItems(getAllLabs())) {
      const lab = getAllLabs().find((entry) => `lab:${entry.id}` === item.id);
      expect(item.outcome, item.id).toBe(lab?.outcome);
    }
  });
});

describe('page and bank outcomes', () => {
  it('keeps any practice page outcome readable', () => {
    for (const page of PRACTICE_PAGES) {
      if (page.outcome !== undefined) expectReadableOutcome(page.href, page.outcome);
    }
  });

  it('gives every interview bank a readable outcome, and no outcome to a bank that does not exist', () => {
    const topics = loadInterviewBanks().map((bank) => bank.topic);
    expect(Object.keys(INTERVIEW_BANK_OUTCOMES).sort()).toEqual([...topics].sort());
    for (const [topic, outcome] of Object.entries(INTERVIEW_BANK_OUTCOMES)) expectReadableOutcome(topic, outcome);
  });
});
