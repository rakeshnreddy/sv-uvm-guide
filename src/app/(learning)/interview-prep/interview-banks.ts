/**
 * Loads the interview question banks in content/interview-questions/*.json for
 * the read-only /interview-prep page and the Practice Hub. The JSON is used
 * as-is; the bank owners edit those files. A new bank file must be added to
 * BANK_FILES below (tests/app/interview-prep-banks.test.ts fails otherwise).
 *
 * The loader also accepts the optional per-question fields that the G29
 * analysis proposes (`modules`, `code`, `follow_ups`, `common_mistakes`, and
 * `sources` written as `{ doc, section, verified }` objects), so the bank group
 * can adopt them without breaking the build. Unknown fields are ignored.
 */
import { z } from 'zod';

import { createSlugger } from '@/lib/heading-slug';
import {
  getInterviewBankLessons,
  getInterviewQuestionLessons,
  sortByCurriculumOrder,
  type LessonLink,
  type PracticeItem,
} from '@/lib/practice-links';

import ambaBank from '../../../../content/interview-questions/amba-protocols.json';
import debugBank from '../../../../content/interview-questions/debug.json';
import socBank from '../../../../content/interview-questions/soc-system-design.json';
import svaBank from '../../../../content/interview-questions/sva-formal.json';
import svBank from '../../../../content/interview-questions/systemverilog.json';
import uvmBank from '../../../../content/interview-questions/uvm.json';

/** File name → parsed JSON, for every bank under content/interview-questions/. */
export const BANK_FILES: Readonly<Record<string, unknown>> = {
  'amba-protocols.json': ambaBank,
  'debug.json': debugBank,
  'soc-system-design.json': socBank,
  'sva-formal.json': svaBank,
  'systemverilog.json': svBank,
  'uvm.json': uvmBank,
};

export const INTERVIEW_LEVELS = ['junior', 'mid', 'senior', 'staff', 'senior-staff'] as const;

const LEVEL_LABELS: Readonly<Record<string, string>> = {
  junior: 'Junior',
  mid: 'Mid-level',
  senior: 'Senior',
  staff: 'Staff',
  'senior-staff': 'Senior staff',
};

const CATEGORY_LABELS: Readonly<Record<string, string>> = {
  concept: 'Concept',
  trick: 'Trick question',
  'waveform-debug': 'Waveform debug',
  debug: 'Debug',
  'predict-output': 'Predict the output',
  coding: 'Coding',
  'verification-plan': 'Verification plan',
  'staff-system-design': 'System design',
};

function humanize(value: string): string {
  const words = value.replace(/[-_]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function levelLabel(level: string): string {
  return LEVEL_LABELS[level] ?? humanize(level);
}

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? humanize(category);
}

/** A source as a plain string, or as a structured `{ doc, section, verified }` object (G29 proposal). */
const sourceSchema = z.union([
  z.string(),
  z
    .object({
      doc: z.string().optional(),
      title: z.string().optional(),
      section: z.string().optional(),
      clause: z.string().optional(),
      verified: z.boolean().optional(),
    })
    .passthrough(),
]);

/** Learner-facing text for one source; structured sources marked `verified: false` say so. */
export function formatSource(source: z.infer<typeof sourceSchema>): string {
  if (typeof source === 'string') return source;
  const text = [source.doc ?? source.title, source.section ?? source.clause].filter(Boolean).join(' ').trim() || 'Unnamed source';
  return source.verified === false ? `${text} (unverified)` : text;
}

const questionSchema = z.object({
  id: z.string().min(1),
  topic: z.string().min(1),
  level: z.string().min(1),
  category: z.string().min(1),
  prompt: z.string().min(1),
  rubric: z.string().default(''),
  model_answer: z.string().min(1),
  sources: z.array(sourceSchema).default([]),
  modules: z.array(z.string().min(1)).default([]),
  code: z.string().optional(),
  follow_ups: z.array(z.string().min(1)).default([]),
  common_mistakes: z.array(z.string().min(1)).default([]),
});

const bankSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().default(''),
  topic: z.string().min(1),
  questions: z.array(questionSchema).min(1),
});

export interface InterviewQuestion {
  id: string;
  level: string;
  levelLabel: string;
  category: string;
  categoryLabel: string;
  prompt: string;
  /** Code the candidate reads with the prompt (optional; shown before the answer is revealed). */
  code?: string;
  rubric: string;
  modelAnswer: string;
  followUps: string[];
  commonMistakes: string[];
  sources: string[];
  /** Lessons that teach this question (may be empty: the bank's related lessons still apply). */
  lessons: LessonLink[];
}

export interface InterviewLevelGroup {
  level: string;
  label: string;
  /** Heading id of the level heading on /interview-prep. */
  anchor: string;
  questions: InterviewQuestion[];
}

export interface InterviewBank {
  file: string;
  id: string;
  topic: string;
  title: string;
  description: string;
  /** Heading id of the bank heading on /interview-prep. */
  anchor: string;
  /** Related lessons, teaching lesson first. */
  lessons: LessonLink[];
  questionCount: number;
  levels: InterviewLevelGroup[];
  /** Manifest position of the bank's first related lesson. */
  order: number;
}

/** Validates one bank file. Throws with the file name so a malformed bank fails the build loudly. */
export function parseInterviewBank(raw: unknown, file: string): z.infer<typeof bankSchema> {
  const result = bankSchema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new Error(`Interview bank ${file} is malformed at ${issue.path.join('.') || '(root)'}: ${issue.message}`);
  }
  return result.data;
}

function levelRank(level: string): number {
  const rank = (INTERVIEW_LEVELS as readonly string[]).indexOf(level);
  return rank === -1 ? INTERVIEW_LEVELS.length : rank;
}

/** Groups questions by level, junior first; unknown levels follow, in first-seen order. Bank order is kept inside a level. */
export function groupQuestionsByLevel<T extends { level: string }>(questions: readonly T[]): { level: string; questions: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const question of questions) {
    const group = groups.get(question.level);
    if (group) group.push(question);
    else groups.set(question.level, [question]);
  }
  return Array.from(groups.entries())
    .map(([level, grouped], position) => ({ level, questions: grouped, position }))
    .sort((a, b) => levelRank(a.level) - levelRank(b.level) || a.position - b.position)
    .map(({ level, questions: grouped }) => ({ level, questions: grouped }));
}

/**
 * All banks, ordered by the curriculum position of their first related lesson,
 * with heading anchors assigned in page order by the shared heading slugger.
 */
export function loadInterviewBanks(): InterviewBank[] {
  const parsed = Object.entries(BANK_FILES).map(([file, raw]) => {
    const bank = parseInterviewBank(raw, file);
    const lessons = getInterviewBankLessons(bank.topic);
    return { file, bank, lessons, order: lessons[0]?.order ?? Number.MAX_SAFE_INTEGER };
  });

  const slug = createSlugger();
  return sortByCurriculumOrder(parsed).map(({ file, bank, lessons, order }) => {
    const anchor = slug(bank.title);
    const levels = groupQuestionsByLevel(bank.questions).map(({ level, questions }) => {
      const label = levelLabel(level);
      return {
        level,
        label,
        anchor: slug(label),
        questions: questions.map((question) => ({
          id: question.id,
          level: question.level,
          levelLabel: label,
          category: question.category,
          categoryLabel: categoryLabel(question.category),
          prompt: question.prompt,
          code: question.code,
          rubric: question.rubric,
          modelAnswer: question.model_answer,
          followUps: question.follow_ups,
          commonMistakes: question.common_mistakes,
          sources: question.sources.map(formatSource),
          lessons: getInterviewQuestionLessons(question.id, question.modules),
        })),
      };
    });
    return {
      file,
      id: bank.id,
      topic: bank.topic,
      title: bank.title,
      description: bank.description,
      anchor,
      lessons,
      questionCount: bank.questions.length,
      levels,
      order,
    };
  });
}

/** The banks as Practice Hub items, linking to their section of /interview-prep. */
export function getInterviewPracticeItems(banks: readonly InterviewBank[] = loadInterviewBanks()): PracticeItem[] {
  return banks.map((bank) => ({
    id: `interview:${bank.topic}`,
    kind: 'interview',
    title: bank.title,
    description: bank.description,
    href: `/interview-prep#${bank.anchor}`,
    status: 'available',
    lessons: bank.lessons,
    order: bank.order,
  }));
}

// ---------------------------------------------------------------------------
// Rich text: the banks use `inline code` and ``` fenced blocks inside strings.
// ---------------------------------------------------------------------------

export type InlinePart = { code: boolean; text: string };
export type RichBlock =
  | { type: 'paragraph'; parts: InlinePart[] }
  | { type: 'code'; language: string; code: string };

/** Splits text into `inline code` and plain parts. An unmatched backtick stays literal. */
export function splitInlineCode(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  const pattern = /`([^`]+)`/g;
  let last = 0;
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    if (match.index > last) parts.push({ code: false, text: text.slice(last, match.index) });
    parts.push({ code: true, text: match[1] });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ code: false, text: text.slice(last) });
  return parts;
}

/** Splits text into paragraphs (blank-line separated) and ``` fenced code blocks. */
export function toRichBlocks(text: string): RichBlock[] {
  const blocks: RichBlock[] = [];
  const fence = /```([\w+-]*)[^\S\n]*\n([\s\S]*?)\n?```/g;
  const pushParagraphs = (chunk: string) => {
    chunk
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean)
      .forEach((paragraph) => blocks.push({ type: 'paragraph', parts: splitInlineCode(paragraph) }));
  };
  let last = 0;
  for (let match = fence.exec(text); match; match = fence.exec(text)) {
    pushParagraphs(text.slice(last, match.index));
    blocks.push({ type: 'code', language: match[1] || 'text', code: match[2].replace(/\s+$/, '') });
    last = match.index + match[0].length;
  }
  pushParagraphs(text.slice(last));
  return blocks;
}
