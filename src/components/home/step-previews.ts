import type { InterviewBank } from '@/app/(learning)/interview-prep/interview-banks';
import type { LabManifest } from '@/lib/lab-manifest';
import type { PracticeItem } from '@/lib/practice-links';

import type { SchedulerFrame } from './scheduler-frame';

/**
 * The plain data behind the small previews on the four "How you learn here"
 * cards. Every value is read from the product's own data, never written by
 * hand: lesson 1's four layers (its own headings), one frame of the scheduler
 * model, a lab's step list and an interview question. Pure, so the page builds
 * it at build time and the cards render it as static markup.
 */

/** Rows the lab preview shows: enough to read as the real thing in a card about 230 px wide. */
export const THUMBNAIL_ROWS = 3;

/** A lesson is written in four layers; the preview draws them. */
export const LESSON_LAYER_COUNT = 4;

export interface LayerRow {
  name: string;
  /** The layer's share of the four layers' text, 0 to 1, drawn as the bar. */
  share: number;
}

export interface ReadPreview {
  /** The module code of the lesson (it sets the tier colour). */
  code: string;
  layers: LayerRow[];
}

export interface StepThroughPreview {
  code: string;
  /** The regions the frame names, in schedule order: the first, the executing one and any with events queued. */
  regions: { id: string; label: string; executing: boolean; queued: number }[];
  /** The statement the frame stops on, without its event control ("q2 <= q1;"). */
  line: string;
  /** The model's own narration of the step, without the statement it starts by repeating. */
  narration: string;
}

export interface LabPreview {
  /** The module code of the lesson that teaches the lab (it sets the tier colour). */
  code: string;
  title: string;
  /** Steps in the whole lab, drawn beside the code instead of the (long) lab title. */
  stepCount: number;
  /** The first steps, each title cut to whole words that fit the card (shortTitle). */
  steps: { number: number; title: string }[];
}

export interface QuestionPreview {
  levelLabel: string;
  categoryLabel: string;
  prompt: string;
  /** The module code of the lesson that teaches it, for the tier colour. */
  code: string | null;
}

export interface StepPreviews {
  read: ReadPreview | null;
  stepThrough: StepThroughPreview;
  build: LabPreview | null;
  rehearse: QuestionPreview | null;
}

/**
 * The first four "## " sections of a lesson's MDX body, each with its share
 * of their text: "Quick Take", "Build Your Mental Model", "Make It Work",
 * "Push Further" in every lesson that follows the template.
 */
export function lessonLayers(body: string, count = LESSON_LAYER_COUNT): LayerRow[] {
  const parts = body.split(/^## +/m).slice(1, count + 1);
  const sections = parts.map((part) => {
    const newline = part.indexOf('\n');
    return { name: (newline < 0 ? part : part.slice(0, newline)).trim(), length: newline < 0 ? 0 : part.length - newline };
  });
  const longest = Math.max(1, ...sections.map((section) => section.length));
  return sections.map((section) => ({ name: section.name, share: section.length / longest }));
}

export function readPreview(code: string, body: string | null): ReadPreview | null {
  if (!body) return null;
  const layers = lessonLayers(body);
  return layers.length === LESSON_LAYER_COUNT ? { code, layers } : null;
}

/** One frame of the scheduler model, reduced to what a small card holds. */
export function stepThroughPreview(code: string, frame: Pick<SchedulerFrame, 'groups' | 'code' | 'narration'>): StepThroughPreview {
  const all = frame.groups.flatMap((group) => group.regions);
  const regions = all
    .filter((region, index) => index === 0 || region.executing || region.queued.length > 0)
    .map((region) => ({ id: region.id, label: region.label, executing: region.executing, queued: region.queued.length }));
  const current = frame.code.find((line) => line.current)?.text.trim() ?? '';
  const statement = current.replace(/^always\s*@\s*\([^)]*\)\s*/, '');
  const rest = statement && frame.narration.startsWith(statement) ? frame.narration.slice(statement.length).trim() : frame.narration;
  return {
    code,
    regions,
    line: statement,
    narration: rest.charAt(0).toUpperCase() + rest.slice(1),
  };
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
export function labPreview(labItems: readonly PracticeItem[], labs: readonly LabManifest[]): LabPreview | null {
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
 * The shortest question at the lowest level any bank holds (the banks list
 * their levels junior first), so the preview shows one whole question.
 */
export function questionPreview(banks: readonly InterviewBank[]): QuestionPreview | null {
  const lowest = banks.flatMap((bank) => bank.levels.filter((group) => group.questions.length > 0).slice(0, 1))[0]?.level;
  const candidates = banks.flatMap((bank) => bank.levels.filter((group) => group.level === lowest).flatMap((group) => group.questions.map((question) => ({ group, question }))));
  const pick = [...candidates].sort((a, b) => a.question.prompt.length - b.question.prompt.length)[0];
  if (!pick) return null;
  const { group, question } = pick;
  return { levelLabel: group.label, categoryLabel: question.categoryLabel, prompt: question.prompt, code: question.lessons[0]?.code ?? null };
}

/** How many interview levels the banks hold between them ("Junior" to "Senior staff"). */
export function interviewLevelCount(banks: readonly InterviewBank[]): number {
  return new Set(banks.flatMap((bank) => bank.levels.filter((group) => group.questions.length > 0).map((group) => group.level))).size;
}

export interface StepPreviewSources {
  /** Lesson 1: its module code and its MDX body. */
  firstLesson: { code: string; body: string | null };
  /** The lesson that holds the live scheduler model, and the frame the preview shows. */
  modelCode: string;
  frame: Pick<SchedulerFrame, 'groups' | 'code' | 'narration'>;
  /** The labs as the Practice hub lists them, in course order (getPracticeLabItems). */
  labItems: readonly PracticeItem[];
  labs: readonly LabManifest[];
  interviewBanks: readonly InterviewBank[];
}

export function buildStepPreviews({ firstLesson, modelCode, frame, labItems, labs, interviewBanks }: StepPreviewSources): StepPreviews {
  return {
    read: readPreview(firstLesson.code, firstLesson.body),
    stepThrough: stepThroughPreview(modelCode, frame),
    build: labPreview(labItems, labs),
    rehearse: questionPreview(interviewBanks),
  };
}
