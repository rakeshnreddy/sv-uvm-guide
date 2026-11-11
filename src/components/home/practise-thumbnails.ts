import type { InterviewBank } from '@/app/(learning)/interview-prep/interview-banks';
import type { LabManifest } from '@/lib/lab-manifest';
import type { PracticeItem } from '@/lib/practice-links';
import { COMMON_PHASES, RUNTIME_PHASES, phaseOrder, type PhaseOrder } from '@/lib/uvm-phase-model';

import type { FrameSignal, SchedulerFrame } from './scheduler-frame';

/**
 * The plain data behind the small drawings on the four "What you can
 * practise" cards. Every value is read from the product's own data, never
 * written by hand: a lab's step list, the phase sorter's two lanes (from the
 * phase model the exercise grades against), the scheduler model's run of the
 * hero's scenario, and interview questions with their levels. Pure, so the
 * page builds it at build time and the cards render it as static markup.
 */

/** Rows each drawing shows: enough to read as the real thing in a card about 230 px wide. */
export const THUMBNAIL_ROWS = 3;

export interface LabThumbnail {
  /** The module code of the lesson that teaches the lab (it sets the tier colour). */
  code: string;
  title: string;
  /** Steps in the whole lab, drawn beside the code instead of the (long) lab title. */
  stepCount: number;
  /** The first steps, each title cut to whole words that fit the card (shortTitle). */
  steps: { number: number; title: string }[];
}

export interface SorterThumbnail {
  /** The module code of the lesson that teaches the exercise. */
  code: string;
  lanes: { id: 'common' | 'schedule'; label: string; phases: { name: string; order: PhaseOrder }[] }[];
}

export interface WaveformThumbnail {
  /** The module code of the lesson that holds the model. */
  code: string;
  signals: FrameSignal[];
  /** The hero frame's step, drawn as the cursor. */
  cursor: number;
}

export interface QuestionThumbnail {
  rows: { level: string; levelLabel: string; prompt: string; code: string | null }[];
}

export interface PractiseThumbnails {
  labs: LabThumbnail | null;
  exercises: SorterThumbnail;
  interactiveModels: WaveformThumbnail;
  interviewPrep: QuestionThumbnail | null;
}

/** "Step 1: Reproduce the Split Bug" -> "Reproduce the Split Bug": the drawing numbers the rows itself. */
export function stepTitle(title: string): string {
  return title.replace(/^step\s+\d+\s*[:.\-–]\s*/i, '').trim() || title;
}

/** The longest step title a thumbnail row holds in the narrowest card (about 200 px of 12 px text). */
export const THUMBNAIL_TITLE_CHARS = 24;

/** Small words a cut title should not end on ("Read the specification and"). */
const TRAILING_FILLER = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'then', 'to', 'with']);

/**
 * A title cut to the whole words that fit in `maxChars`, never mid-word and
 * without an ellipsis, so the drawing reads as a clean label rather than
 * truncated UI: "Read the specification and run the starter" -> "Read the
 * specification". A first word longer than the limit is kept whole.
 */
export function shortTitle(title: string, maxChars = THUMBNAIL_TITLE_CHARS): string {
  const words = title.trim().split(/\s+/);
  const kept: string[] = [];
  for (const word of words) {
    if (kept.length > 0 && [...kept, word].join(' ').length > maxChars) break;
    kept.push(word);
  }
  while (kept.length > 1 && kept.length < words.length && TRAILING_FILLER.has(kept[kept.length - 1].toLowerCase())) kept.pop();
  return kept.join(' ').replace(/[,;:]$/, '');
}

/** The first lab in course order that a learner can open, with its first steps. */
export function labThumbnail(labItems: readonly PracticeItem[], labs: readonly LabManifest[]): LabThumbnail | null {
  for (const item of labItems) {
    const lab = labs.find((entry) => `lab:${entry.id}` === item.id);
    if (!lab || lab.status !== 'available' || lab.steps.length === 0) continue;
    return {
      code: item.lessons[0]?.code ?? lab.owningModule,
      title: lab.title,
      stepCount: lab.steps.length,
      steps: lab.steps.slice(0, THUMBNAIL_ROWS).map((step, index) => ({ number: index + 1, title: shortTitle(stepTitle(step.title)) })),
    };
  }
  return null;
}

/**
 * The phase sorter's two lanes, in schedule order, from the phase model it
 * grades against. Each lane shows its one-word phases (build, connect, run;
 * reset, configure, main), so no name is cut in a card about 230 px wide.
 */
export function sorterThumbnail(code: string): SorterThumbnail {
  const lane = (phases: typeof COMMON_PHASES) =>
    phases
      .filter((phase) => !phase.name.includes('_'))
      .slice(0, THUMBNAIL_ROWS)
      .map((phase) => ({ name: phase.name, order: phaseOrder(phase) }));
  return {
    code,
    lanes: [
      { id: 'common', label: 'Common', phases: lane(COMMON_PHASES) },
      { id: 'schedule', label: 'Schedule', phases: lane(RUNTIME_PHASES) },
    ],
  };
}

/** Two questions from the first bank: the first of its lowest level and the first of its highest, the range the card's line states. */
export function questionThumbnail(banks: readonly InterviewBank[]): QuestionThumbnail | null {
  const bank = banks.find((entry) => entry.levels.some((group) => group.questions.length > 0));
  if (!bank) return null;
  const levels = bank.levels.filter((group) => group.questions.length > 0);
  const picks = levels.length > 1 ? [levels[0], levels[levels.length - 1]] : levels;
  return {
    rows: picks
      .map((group) => {
        const question = group.questions[0];
        return { level: group.level, levelLabel: group.label, prompt: question.prompt, code: question.lessons[0]?.code ?? null };
      }),
  };
}

export interface ThumbnailSources {
  /** The labs as the Practice hub lists them, in course order (getPracticeLabItems). */
  labItems: readonly PracticeItem[];
  labs: readonly LabManifest[];
  interviewBanks: readonly InterviewBank[];
  /** The hero's scheduler frame: its signals over the whole run. */
  frame: Pick<SchedulerFrame, 'signals' | 'stepIndex'>;
  /** Module codes of the lessons that teach the phase sorter and the scheduler model. */
  sorterCode: string;
  modelCode: string;
}

export function buildPractiseThumbnails({
  labItems,
  labs,
  interviewBanks,
  frame,
  sorterCode,
  modelCode,
}: ThumbnailSources): PractiseThumbnails {
  return {
    labs: labThumbnail(labItems, labs),
    exercises: sorterThumbnail(sorterCode),
    interactiveModels: { code: modelCode, signals: frame.signals, cursor: frame.stepIndex },
    interviewPrep: questionThumbnail(interviewBanks),
  };
}
