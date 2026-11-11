/**
 * Interview questions the learner marked as practised, one record:
 * 'sv-uvm-guide:interview-practised' → {"v":1,"data":{"questions":{...}}}.
 *
 * Only the learner sets or clears a mark (the toggle inside an opened
 * question); opening, expanding or time spent never does. Each mark keeps the
 * bank and level the question had when it was marked, so the index page and
 * the dashboard can count marks without the question data; a bank page counts
 * from its own rows instead (src/components/interview/practised-marks.ts).
 *
 * The pre-paint script on the interview pages reads this key directly, so
 * the stored shape is part of its contract: keep it in step with
 * practisedBootScript.
 */
import { INTERVIEW_PRACTISED_KEY } from '../keys';
import { defineRecord, isPlainObject, isTimestamp, recordOf, type WriteOutcome } from '../record';

export const INTERVIEW_PRACTISED_MAX_CHARS = 100_000;

/** Question ids, bank slugs and level values are plain slugs (they become attribute values and element ids). */
const SLUG = /^[a-z0-9][a-z0-9-]*$/;

export function isInterviewSlug(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 120 && SLUG.test(value);
}

export interface PractisedMark {
  /** Epoch ms the learner marked it. */
  at: number;
  /** The bank's page slug ('systemverilog'). */
  bank: string;
  /** The question's level ('junior'). */
  level: string;
}

export interface InterviewPractisedData {
  /** Question id → its mark. */
  questions: Record<string, PractisedMark>;
}

const EMPTY_PRACTISED: InterviewPractisedData = Object.freeze({
  questions: Object.freeze({}) as Record<string, PractisedMark>,
});

function parseMark(value: unknown, id: string): PractisedMark | null {
  if (!isInterviewSlug(id) || !isPlainObject(value)) return null;
  if (!isTimestamp(value.at) || !isInterviewSlug(value.bank) || !isInterviewSlug(value.level)) return null;
  return { at: value.at, bank: value.bank, level: value.level };
}

export function parseInterviewPractised(data: unknown): InterviewPractisedData | null {
  if (!isPlainObject(data)) return null;
  return { questions: recordOf(data.questions, parseMark) };
}

/** Marks from both sides are kept; for a question marked on both, the later mark wins. */
export function mergeInterviewPractised(local: InterviewPractisedData, incoming: InterviewPractisedData): InterviewPractisedData {
  const questions: Record<string, PractisedMark> = { ...local.questions };
  for (const [id, mark] of Object.entries(incoming.questions)) {
    const existing = questions[id];
    questions[id] = existing && existing.at >= mark.at ? existing : mark;
  }
  return { questions };
}

export const interviewPractisedRecord = defineRecord<InterviewPractisedData>({
  key: INTERVIEW_PRACTISED_KEY,
  version: 1,
  empty: EMPTY_PRACTISED,
  parse: parseInterviewPractised,
  maxChars: INTERVIEW_PRACTISED_MAX_CHARS,
  merge: mergeInterviewPractised,
});

/**
 * Sets (with the question's bank and level) or clears one mark, on a fresh
 * read so marks from another tab are kept. Called only from the learner's
 * own toggle.
 */
export function setQuestionPractised(
  id: string,
  mark: { bank: string; level: string } | null,
  now: number = Date.now(),
): WriteOutcome {
  return interviewPractisedRecord.update((data) => {
    const existing = data.questions[id];
    if (!mark) {
      if (!existing) return data;
      const questions = { ...data.questions };
      delete questions[id];
      return { questions };
    }
    if (!isInterviewSlug(id) || !isInterviewSlug(mark.bank) || !isInterviewSlug(mark.level)) return data;
    if (existing && existing.bank === mark.bank && existing.level === mark.level) return data;
    return { questions: { ...data.questions, [id]: { at: now, bank: mark.bank, level: mark.level } } };
  });
}

/** How many questions are marked (every bank). */
export function practisedCount(data: InterviewPractisedData): number {
  return Object.keys(data.questions).length;
}
