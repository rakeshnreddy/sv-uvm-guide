import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  INTERVIEW_HIDE_PRACTISED_KEY,
  INTERVIEW_LEVEL_KEY,
  INTERVIEW_PRACTISED_KEY,
  __resetRecordsForTests,
  __resetStorageForTests,
  interviewPractisedRecord,
  isLearnerKey,
  mergeInterviewPractised,
  parseInterviewPractised,
  practisedCount,
  setQuestionPractised,
} from '@/lib/learner-store';

const NOW = Date.UTC(2026, 10, 11, 12);

beforeEach(() => {
  window.localStorage.clear();
  __resetStorageForTests();
  __resetRecordsForTests();
});

afterEach(() => {
  window.localStorage.clear();
});

describe('interview practised marks', () => {
  it('is learner data under its own key; "Hide practised" and the level are UI conveniences', () => {
    expect(INTERVIEW_PRACTISED_KEY).toBe('sv-uvm-guide:interview-practised');
    expect(isLearnerKey(INTERVIEW_PRACTISED_KEY)).toBe(true);
    expect(isLearnerKey(INTERVIEW_HIDE_PRACTISED_KEY)).toBe(false);
    expect(isLearnerKey(INTERVIEW_LEVEL_KEY)).toBe(false);
  });

  it('sets a mark with its bank and level, and clears it, in the versioned envelope', () => {
    expect(setQuestionPractised('uvm-why-uvm', { bank: 'uvm', level: 'junior' }, NOW)).toBe('saved');
    expect(JSON.parse(window.localStorage.getItem(INTERVIEW_PRACTISED_KEY) ?? 'null')).toEqual({
      v: 1,
      data: { questions: { 'uvm-why-uvm': { at: NOW, bank: 'uvm', level: 'junior' } } },
    });
    expect(practisedCount(interviewPractisedRecord.read())).toBe(1);

    expect(setQuestionPractised('uvm-why-uvm', null)).toBe('saved');
    expect(interviewPractisedRecord.read().questions).toEqual({});
  });

  it('keeps the first time when the same mark is set again, and refuses ids that are not slugs', () => {
    setQuestionPractised('sv-a', { bank: 'systemverilog', level: 'junior' }, NOW);
    setQuestionPractised('sv-a', { bank: 'systemverilog', level: 'junior' }, NOW + 1000);
    expect(interviewPractisedRecord.read().questions['sv-a'].at).toBe(NOW);
    setQuestionPractised('Not a slug', { bank: 'systemverilog', level: 'junior' }, NOW);
    setQuestionPractised('sv-b', { bank: 'system verilog', level: 'junior' }, NOW);
    expect(Object.keys(interviewPractisedRecord.read().questions)).toEqual(['sv-a']);
  });

  it('drops malformed marks when parsing (a hand-edited store or an old backup)', () => {
    expect(parseInterviewPractised(null)).toBeNull();
    expect(
      parseInterviewPractised({
        questions: {
          good: { at: NOW, bank: 'uvm', level: 'mid' },
          'no-time': { bank: 'uvm', level: 'mid' },
          'bad-level': { at: NOW, bank: 'uvm', level: '<b>' },
          'Bad Id': { at: NOW, bank: 'uvm', level: 'mid' },
          'far-future': { at: 1e300, bank: 'uvm', level: 'mid' },
        },
      }),
    ).toEqual({ questions: { good: { at: NOW, bank: 'uvm', level: 'mid' } } });
  });

  it('merges by keeping marks from both sides, the later mark winning for the same question', () => {
    const local = { questions: { a: { at: 5, bank: 'uvm', level: 'junior' }, b: { at: 9, bank: 'uvm', level: 'mid' } } };
    const incoming = { questions: { b: { at: 7, bank: 'uvm', level: 'senior' }, c: { at: 1, bank: 'debug', level: 'staff' } } };
    expect(mergeInterviewPractised(local, incoming)).toEqual({
      questions: { a: local.questions.a, b: local.questions.b, c: incoming.questions.c },
    });
    expect(mergeInterviewPractised(incoming, local).questions.b).toEqual(local.questions.b);
  });
});
