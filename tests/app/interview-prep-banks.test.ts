import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  BANK_FILES,
  INTERVIEW_LEVELS,
  formatSource,
  getInterviewPracticeItems,
  groupQuestionsByLevel,
  levelLabel,
  loadInterviewBanks,
  parseInterviewBank,
  splitInlineCode,
  toRichBlocks,
} from '@/app/(learning)/interview-prep/interview-banks';
import { headingSlug } from '@/lib/heading-slug';
import {
  INTERVIEW_BANK_LESSONS,
  INTERVIEW_QUESTION_LESSONS,
  getInterviewQuestionLessons,
  resolveLessonRef,
} from '@/lib/practice-links';

const banksDir = path.resolve(__dirname, '../../content/interview-questions');

interface RawBank {
  id: string;
  title: string;
  topic: string;
  questions: { id: string; level: string; prompt: string; model_answer: string; modules?: string[] }[];
}

const rawBanks: Record<string, RawBank> = Object.fromEntries(
  fs
    .readdirSync(banksDir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => [file, JSON.parse(fs.readFileSync(path.join(banksDir, file), 'utf8')) as RawBank]),
);
const rawQuestions = Object.values(rawBanks).flatMap((bank) => bank.questions);

describe('interview bank loading', () => {
  it('imports every bank file in content/interview-questions', () => {
    expect(Object.keys(BANK_FILES).sort()).toEqual(Object.keys(rawBanks).sort());
  });

  it('loads the banks as-is: same questions, prompts and model answers', () => {
    const banks = loadInterviewBanks();
    expect(banks).toHaveLength(Object.keys(rawBanks).length);
    for (const bank of banks) {
      const raw = rawBanks[bank.file];
      expect(bank).toMatchObject({ id: raw.id, title: raw.title, topic: raw.topic, questionCount: raw.questions.length });
      const loaded = bank.levels.flatMap((group) => group.questions);
      expect(loaded.map((question) => question.id).sort()).toEqual(raw.questions.map((question) => question.id).sort());
      for (const question of loaded) {
        const source = raw.questions.find((entry) => entry.id === question.id);
        expect(question.prompt).toBe(source?.prompt);
        expect(question.modelAnswer).toBe(source?.model_answer);
        expect(question.level).toBe(source?.level);
      }
    }
  });

  it('groups each bank by level, junior first, keeping bank order inside a level', () => {
    for (const bank of loadInterviewBanks()) {
      const ranks = bank.levels.map((group) => (INTERVIEW_LEVELS as readonly string[]).indexOf(group.level));
      expect(ranks.every((rank) => rank >= 0)).toBe(true);
      expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
      const raw = rawBanks[bank.file];
      for (const group of bank.levels) {
        expect(group.label).toBe(levelLabel(group.level));
        expect(group.questions.map((question) => question.id)).toEqual(
          raw.questions.filter((question) => question.level === group.level).map((question) => question.id),
        );
      }
    }
  });

  it('puts unknown levels last instead of dropping them', () => {
    const grouped = groupQuestionsByLevel([
      { id: 'a', level: 'principal' },
      { id: 'b', level: 'staff' },
      { id: 'c', level: 'junior' },
      { id: 'd', level: 'staff' },
    ]);
    expect(grouped.map((group) => [group.level, group.questions.map((question) => question.id)])).toEqual([
      ['junior', ['c']],
      ['staff', ['b', 'd']],
      ['principal', ['a']],
    ]);
    expect(levelLabel('senior-staff')).toBe('Senior staff');
    expect(levelLabel('principal')).toBe('Principal');
  });

  it('links every bank and every question to lessons', () => {
    for (const bank of loadInterviewBanks()) {
      expect(bank.lessons.length, `bank ${bank.topic} has no related lessons`).toBeGreaterThan(0);
      for (const question of bank.levels.flatMap((group) => group.questions)) {
        expect(
          question.lessons.length,
          `question ${question.id} has no lesson: give it "modules" in the bank JSON or an INTERVIEW_QUESTION_LESSONS entry`,
        ).toBeGreaterThan(0);
        for (const lesson of question.lessons) expect(lesson.href).toMatch(/^\/curriculum\/T[1-4]_/);
      }
    }
  });

  it('has no stale entries in the lesson maps', () => {
    const questionIds = new Set(rawQuestions.map((question) => question.id));
    expect(Object.keys(INTERVIEW_QUESTION_LESSONS).filter((id) => !questionIds.has(id))).toEqual([]);
    const topics = new Set(Object.values(rawBanks).map((bank) => bank.topic));
    expect(Object.keys(INTERVIEW_BANK_LESSONS).filter((topic) => !topics.has(topic))).toEqual([]);
  });

  it('orders banks by their home lesson and gives every heading a unique anchor', () => {
    const banks = loadInterviewBanks();
    const orders = banks.map((bank) => bank.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    expect(banks[0].topic).toBe('sv');
    const anchors = banks.flatMap((bank) => [bank.anchor, ...bank.levels.map((group) => group.anchor)]);
    expect(new Set(anchors).size).toBe(anchors.length);
    for (const bank of banks) expect(bank.anchor).toBe(headingSlug(bank.title));
  });

  it('turns banks into Practice Hub items that link to their section', () => {
    const banks = loadInterviewBanks();
    const items = getInterviewPracticeItems(banks);
    expect(items.map((item) => item.href)).toEqual(banks.map((bank) => `/interview-prep#${bank.anchor}`));
    for (const item of items) {
      expect(item.kind).toBe('interview');
      expect(item.status).toBe('available');
      expect(item.lessons.length).toBeGreaterThan(0);
    }
  });

  it('lets a question name its own lessons with "modules", ahead of the practice map', () => {
    expect(getInterviewQuestionLessons('uvm-factory-purpose').map((lesson) => lesson.ref)).toEqual([
      'I-UVM-1B_The_UVM_Factory/index',
    ]);
    expect(
      getInterviewQuestionLessons('uvm-factory-purpose', [
        'I-UVM-3B_Advanced_Sequencing_and_Layering/virtual-sequences',
        'I-UVM-2C',
        'F4B_Interfaces_and_Modports',
        'NOT-A-MODULE',
      ]).map((lesson) => lesson.ref),
    ).toEqual([
      'I-UVM-3B_Advanced_Sequencing_and_Layering/virtual-sequences',
      'F4B_Interfaces_and_Modports/index',
      'I-UVM-2C_Configuration_and_Resources/index',
    ]);
    expect(getInterviewQuestionLessons('no-such-question')).toEqual([]);
  });

  it('resolves every "modules" entry the banks declare', () => {
    for (const question of rawQuestions) {
      for (const entry of question.modules ?? []) {
        expect(resolveLessonRef(entry), `${question.id}: "${entry}" names no module or lesson`).toBeDefined();
      }
    }
  });

  it('accepts the optional fields proposed by G29 and ignores unknown ones', () => {
    const bank = parseInterviewBank(
      {
        id: 'future',
        title: 'Future bank',
        topic: 'uvm',
        unknownBankField: true,
        questions: [
          {
            id: 'future-q',
            topic: 'uvm',
            level: 'mid',
            category: 'predict-output',
            prompt: 'What prints?',
            rubric: 'Names the phase order.',
            model_answer: 'build, then connect.',
            sources: ['IEEE 1800.2-2020 §9.8.1', { doc: 'IHI0022E', section: 'A3.4.1', verified: true }, { doc: 'IHI0050F', verified: false }],
            modules: ['I-UVM-1C'],
            code: 'initial run_test();',
            follow_ups: ['Which phase is a task?'],
            common_mistakes: ['Assuming connect_phase runs top-down.'],
            waveform: { signal: [] },
          },
        ],
      },
      'future.json',
    );
    const [question] = bank.questions;
    expect(question.sources.map(formatSource)).toEqual([
      'IEEE 1800.2-2020 §9.8.1',
      'IHI0022E A3.4.1',
      'IHI0050F (unverified)',
    ]);
    expect(question).toMatchObject({
      modules: ['I-UVM-1C'],
      code: 'initial run_test();',
      follow_ups: ['Which phase is a task?'],
      common_mistakes: ['Assuming connect_phase runs top-down.'],
    });
    expect(question).not.toHaveProperty('waveform');
  });

  it('rejects a malformed bank with its file name', () => {
    expect(() => parseInterviewBank({ id: 'x', title: 'X', topic: 'sv', questions: [] }, 'broken.json')).toThrow(
      /broken\.json.*questions/,
    );
    expect(() => parseInterviewBank(null, 'empty.json')).toThrow(/empty\.json/);
  });
});

describe('bank rich text', () => {
  it('splits inline code and keeps an unmatched backtick literal', () => {
    expect(splitInlineCode('Use `get_next_item()` then `item_done()`.')).toEqual([
      { code: false, text: 'Use ' },
      { code: true, text: 'get_next_item()' },
      { code: false, text: ' then ' },
      { code: true, text: 'item_done()' },
      { code: false, text: '.' },
    ]);
    expect(splitInlineCode('a ` b')).toEqual([{ code: false, text: 'a ` b' }]);
  });

  it('splits fenced code blocks from paragraphs', () => {
    const blocks = toRichBlocks('Intro line.\n```systemverilog\nassert property (p);\n```\nAfter.\n\nSecond paragraph.');
    expect(blocks).toEqual([
      { type: 'paragraph', parts: [{ code: false, text: 'Intro line.' }] },
      { type: 'code', language: 'systemverilog', code: 'assert property (p);' },
      { type: 'paragraph', parts: [{ code: false, text: 'After.' }] },
      { type: 'paragraph', parts: [{ code: false, text: 'Second paragraph.' }] },
    ]);
    expect(toRichBlocks('```\nx = 1;\n```')).toEqual([{ type: 'code', language: 'text', code: 'x = 1;' }]);
  });

  it('renders every fenced block in the banks as code', () => {
    for (const question of rawQuestions) {
      const fences = (question.model_answer.match(/```/g) ?? []).length / 2;
      const code = toRichBlocks(question.model_answer).filter((block) => block.type === 'code');
      expect(code, question.id).toHaveLength(fences);
    }
  });
});
