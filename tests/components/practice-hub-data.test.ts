import { describe, expect, it } from 'vitest';

import {
  OUTCOME_MAX_CHARS,
  UNTIERED_GROUP_TITLE,
  countLabel,
  firstSentence,
  groupByTier,
  labRowMeta,
  outcomeLine,
  tierTitle,
  topicsLine,
} from '@/components/practice/practice-hub-data';
import { getInterviewPracticeItems } from '@/app/(learning)/interview-prep/interview-banks';
import { getAllLabs, labCheckSummary } from '@/lib/lab-registry';
import { getInterviewBankOutcome, getPracticeLabItems, getPracticePages, type LessonLink } from '@/lib/practice-links';
import { TIER_LINKS } from '@/lib/site-links';

describe('outcomeLine', () => {
  it('keeps a short first sentence whole and drops the rest', () => {
    expect(firstSentence('Edit timing diagrams as you type. Includes two debug samples.')).toBe('Edit timing diagrams as you type.');
    expect(firstSentence('Checked against uvm-core 2020.3.1 rules')).toBe('Checked against uvm-core 2020.3.1 rules');
    expect(outcomeLine('Edit timing diagrams as you type. Includes two debug samples.')).toBe('Edit timing diagrams as you type.');
  });

  it('cuts a long sentence at a clause or a word, never inside a word, and marks the cut', () => {
    const long =
      'Build a small UVM environment for a synchronous round-robin arbiter from its specification, an agent that drives request vectors through a clocking block, and a monitor.';
    const line = outcomeLine(long, 120);
    expect(line.length).toBeLessThanOrEqual(121);
    expect(line.endsWith('…')).toBe(true);
    expect(long.startsWith(line.slice(0, -1))).toBe(true);
    // The character after the cut is a boundary, not the middle of a word.
    expect(long.charAt(line.length - 1)).toMatch(/[\s,;:]/);

    const noClause = `${'word '.repeat(40)}end.`;
    const cut = outcomeLine(noClause);
    expect(cut).toMatch(/^(word )*word…$/);
  });

  it('gives every lab, page and bank on the hub a line within the limit that ends a word', () => {
    const items = [...getPracticeLabItems(getAllLabs()), ...getPracticePages(), ...getInterviewPracticeItems()];
    for (const item of items) {
      const line = outcomeLine(item.description);
      expect(line.length, item.id).toBeLessThanOrEqual(OUTCOME_MAX_CHARS + 1);
      if (line.endsWith('…')) {
        const kept = line.slice(0, -1);
        const next = firstSentence(item.description).charAt(kept.length);
        expect(next, item.id).toMatch(/[\s,;:.]/);
      }
    }
  });

  it('uses an author-written outcome as written, ahead of the description', () => {
    const description = `${'A very long first sentence, '.repeat(10)}end.`;
    expect(outcomeLine({ description, outcome: 'Build the thing.' })).toBe('Build the thing.');
    expect(outcomeLine({ description: 'Short one. More.' })).toBe('Short one.');
    // An empty outcome is no outcome: the description's first sentence is used.
    expect(outcomeLine({ description: 'Short one. More.', outcome: '  ' })).toBe('Short one.');
    expect(outcomeLine({ description })).toBe(outcomeLine(description));
    expect(topicsLine({ description: 'Interview preparation from junior to senior staff: arrays.', outcome: 'Arrays and queues.' })).toBe(
      'Arrays and queues.',
    );
    expect(topicsLine({ description: 'Interview preparation from junior to senior staff: arrays.' })).toBe('Arrays.');
  });

  it('ends no practice hub row in an ellipsis: labs, pages and banks all read whole', () => {
    const rows = [
      ...getPracticeLabItems(getAllLabs()).map((item) => [item.id, outcomeLine(item)] as const),
      ...getPracticePages().map((item) => [item.id, outcomeLine(item)] as const),
      // The hub reads a bank by topicsLine; its outcome comes from INTERVIEW_BANK_OUTCOMES.
      ...getInterviewPracticeItems().map(
        (item) => [item.id, topicsLine({ ...item, outcome: item.outcome ?? getInterviewBankOutcome(item.id.replace(/^interview:/, '')) })] as const,
      ),
    ];
    expect(rows.length).toBeGreaterThan(50);
    for (const [id, line] of rows) {
      expect(line, id).not.toMatch(/(?:\u2026|\.\.\.)$/);
      expect(line.length, id).toBeGreaterThan(0);
    }
  });

  it('reads an interview bank by its topics, without the shared lead-in', () => {
    expect(topicsLine('Interview preparation from junior to senior staff: data types and arrays.')).toBe('Data types and arrays.');
    expect(topicsLine('No lead-in here.')).toBe('No lead-in here.');
    expect(topicsLine('Interview preparation from junior to senior staff covering APB, AHB and AXI4.')).toBe('APB, AHB and AXI4.');
  });

  it('reads every interview bank by its topics, none keeping the lead-in', () => {
    for (const item of getInterviewPracticeItems()) {
      expect(topicsLine(item.description), item.id).not.toMatch(/^Interview prep/i);
    }
  });

  it('keeps every first sentence within the limit whole', () => {
    const items = [...getPracticeLabItems(getAllLabs()), ...getPracticePages(), ...getInterviewPracticeItems()];
    for (const item of items) {
      const sentence = firstSentence(item.description);
      if (sentence.length <= OUTCOME_MAX_CHARS) expect(outcomeLine(item.description), item.id).toBe(sentence);
    }
  });
});

describe('groupByTier', () => {
  const lesson = (code: string): LessonLink => ({ code } as LessonLink);

  it('orders tiers 1 to 4, keeps item order inside a tier, and puts untiered items last', () => {
    const items = [
      { id: 'a', lessons: [lesson('E-DBG-1')] },
      { id: 'b', lessons: [lesson('F2A')] },
      { id: 'c', lessons: [] },
      { id: 'd', lessons: [lesson('F2D')] },
      { id: 'e', lessons: [lesson('B-AXI-1')] },
    ];
    const groups = groupByTier(items);
    expect(groups.map((group) => [group.tier, group.items.map((item) => item.id)])).toEqual([
      [1, ['b', 'd']],
      [3, ['e']],
      [4, ['a']],
      [undefined, ['c']],
    ]);
    expect(groups[0].title).toBe('Tier 1: Foundations');
    expect(groups[3].title).toBe(UNTIERED_GROUP_TITLE);
  });

  it('names each tier as the footer and the curriculum page do', () => {
    expect(([1, 2, 3, 4] as const).map(tierTitle)).toEqual(TIER_LINKS.map((link) => link.label));
  });

  it('places every lab in a tier group', () => {
    const labs = getPracticeLabItems(getAllLabs());
    const groups = groupByTier(labs);
    expect(groups.reduce((sum, group) => sum + group.items.length, 0)).toBe(labs.length);
  });
});

describe('lab row meta', () => {
  it('says how many steps and how they are checked, following labCheckSummary', () => {
    for (const lab of getAllLabs()) {
      const meta = labRowMeta(lab);
      expect(meta).toBe(
        `${countLabel(lab.steps.length, 'step')} · ${labCheckSummary(lab).startsWith('Auto') ? 'auto-checked' : 'self-checked'}`,
      );
    }
    expect(countLabel(1, 'step')).toBe('1 step');
    expect(countLabel(3, 'lab')).toBe('3 labs');
  });
});
