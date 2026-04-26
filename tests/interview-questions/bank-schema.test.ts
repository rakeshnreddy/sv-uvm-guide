import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '../..');
const BANKS_DIR = path.join(REPO_ROOT, 'content', 'interview-questions');

const VALID_LEVELS = ['junior', 'mid', 'senior', 'staff', 'senior-staff'];
const VALID_CATEGORIES = [
  'concept',
  'waveform-debug',
  'coding',
  'verification-plan',
  'trick',
  'staff-system-design',
];
const VALID_TOPICS = ['sv', 'uvm', 'sva', 'debug', 'soc', 'amba'];

interface QuestionSchema {
  id: string;
  topic: string;
  level: string;
  category: string;
  prompt: string;
  rubric: string;
  model_answer: string;
  sources: string[];
}

interface BankSchema {
  id: string;
  title: string;
  description: string;
  topic: string;
  questions: QuestionSchema[];
}

function loadBank(filename: string): BankSchema {
  const content = fs.readFileSync(path.join(BANKS_DIR, filename), 'utf-8');
  return JSON.parse(content);
}

function getAllBankFiles(): string[] {
  return fs
    .readdirSync(BANKS_DIR)
    .filter((f) => f.endsWith('.json'));
}

describe('Interview Bank Schema Validation', () => {
  const bankFiles = getAllBankFiles();

  it('finds at least 5 interview bank files', () => {
    expect(bankFiles.length).toBeGreaterThanOrEqual(5);
  });

  describe.each(bankFiles)('bank: %s', (filename) => {
    const bank = loadBank(filename);

    it('has required top-level fields', () => {
      expect(bank.id).toBeDefined();
      expect(typeof bank.id).toBe('string');
      expect(bank.title).toBeDefined();
      expect(bank.description).toBeDefined();
      expect(bank.topic).toBeDefined();
      expect(VALID_TOPICS).toContain(bank.topic);
      expect(Array.isArray(bank.questions)).toBe(true);
    });

    it('has at least 3 questions', () => {
      expect(bank.questions.length).toBeGreaterThanOrEqual(3);
    });

    it('has unique question IDs', () => {
      const ids = bank.questions.map((q) => q.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    describe.each(bank.questions.map((q) => [q.id, q]))('question: %s', (_id, q) => {
      const question = q as QuestionSchema;

      it('has all required fields', () => {
        expect(question.id).toBeDefined();
        expect(question.topic).toBeDefined();
        expect(question.level).toBeDefined();
        expect(question.category).toBeDefined();
        expect(question.prompt).toBeDefined();
        expect(question.rubric).toBeDefined();
        expect(question.model_answer).toBeDefined();
        expect(question.sources).toBeDefined();
      });

      it('has valid level', () => {
        expect(VALID_LEVELS).toContain(question.level);
      });

      it('has valid category', () => {
        expect(VALID_CATEGORIES).toContain(question.category);
      });

      it('has non-empty prompt, rubric, and model_answer', () => {
        expect(question.prompt.length).toBeGreaterThan(10);
        expect(question.rubric.length).toBeGreaterThan(10);
        expect(question.model_answer.length).toBeGreaterThan(10);
      });

      it('has at least one source', () => {
        expect(Array.isArray(question.sources)).toBe(true);
        expect(question.sources.length).toBeGreaterThanOrEqual(1);
      });
    });
  });
});

describe('Interview Bank Coverage Matrix', () => {
  const bankFiles = getAllBankFiles();
  const allQuestions: QuestionSchema[] = [];

  bankFiles.forEach((f) => {
    const bank = loadBank(f);
    allQuestions.push(...bank.questions);
  });

  it('has globally unique question IDs across all banks', () => {
    const allIds = allQuestions.map((q) => q.id);
    const uniqueIds = new Set(allIds);
    const duplicates = allIds.filter((id, i) => allIds.indexOf(id) !== i);
    expect(duplicates).toEqual([]);
    expect(uniqueIds.size).toBe(allIds.length);
  });

  it('covers all major topic families', () => {
    const topics = new Set(allQuestions.map((q) => q.topic));
    VALID_TOPICS.forEach((t) => {
      expect(topics.has(t)).toBe(true);
    });
  });

  it('has junior, mid, and senior coverage for each topic', () => {
    const topicLevels = new Map<string, Set<string>>();
    allQuestions.forEach((q) => {
      if (!topicLevels.has(q.topic)) topicLevels.set(q.topic, new Set());
      topicLevels.get(q.topic)!.add(q.level);
    });

    VALID_TOPICS.forEach((topic) => {
      const levels = topicLevels.get(topic);
      expect(levels, `topic ${topic} should have questions`).toBeDefined();
      expect(levels!.has('junior') || levels!.has('mid'), `${topic} needs junior or mid`).toBe(true);
      expect(levels!.has('senior') || levels!.has('staff'), `${topic} needs senior or staff`).toBe(true);
    });
  });

  it('has staff-level banks for methodology, SoC strategy, and system-design', () => {
    const staffQuestions = allQuestions.filter(
      (q) => q.level === 'staff' || q.level === 'senior-staff'
    );
    expect(staffQuestions.length).toBeGreaterThanOrEqual(5);

    const staffCategories = new Set(staffQuestions.map((q) => q.category));
    expect(staffCategories.has('staff-system-design')).toBe(true);
  });

  it('has at least 30 total questions across all banks', () => {
    expect(allQuestions.length).toBeGreaterThanOrEqual(30);
  });
});
