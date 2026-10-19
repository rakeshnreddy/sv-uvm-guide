/**
 * The SM-2 spaced-repetition scheduler, shared by the browser review store
 * (src/lib/srs/review-store.ts) and the account-era server action
 * reviewFlashcard (src/app/actions/srs.ts).
 *
 * Pure and client-safe: no storage, no server imports, and `now` is always
 * passed in.
 *
 * Quality is an integer from 0 to 5. The lesson and review buttons use
 * Again 0, Hard 3, Good 4 and Easy 5, so Hard still passes.
 * - q >= 3 (a pass): the interval goes 1 day, then 6 days, then
 *   round(interval x EF), and repetitions increase by one.
 * - q < 3 (a lapse): repetitions return to 0, the interval to 1 day, and
 *   lapses increase by one.
 * - Either way EF += 0.1 - (5 - q)(0.08 + (5 - q) 0.02), never below 1.3, and
 *   reviews increase by one.
 * - dueAt is `now` plus the interval in local calendar days (time.ts
 *   addDays), so a card keeps its time of day across daylight-saving changes;
 *   a card is due once dueAt falls on or before the end of the learner's local
 *   day (isCardDue in the flashcards repository).
 */
import type { SrsCardState } from '@/lib/learner-store/repositories/flashcards';
import { addDays } from '@/lib/learner-store/time';

export type ReviewQuality = 0 | 1 | 2 | 3 | 4 | 5;

export type RatingLabel = 'Again' | 'Hard' | 'Good' | 'Easy';

export interface Rating {
  label: RatingLabel;
  q: ReviewQuality;
}

/** The four rating buttons, in display order. */
export const RATINGS: readonly Rating[] = Object.freeze([
  Object.freeze({ label: 'Again', q: 0 }),
  Object.freeze({ label: 'Hard', q: 3 }),
  Object.freeze({ label: 'Good', q: 4 }),
  Object.freeze({ label: 'Easy', q: 5 }),
] satisfies Rating[]);

/** The easiness factor of a card that has never been reviewed. */
export const INITIAL_EASE = 2.5;
/** SM-2's floor for the easiness factor. */
export const MIN_EASE = 1.3;
/** The lowest quality that counts as a pass. */
export const PASSING_QUALITY = 3;

/**
 * The fields the scheduler reads. A stored SrsCardState works as it is; the
 * server action passes its Prisma row's interval, repetitions and
 * easinessFactor (as `ease`).
 */
export interface SrsScheduleInput {
  interval: number;
  repetitions: number;
  ease: number;
  lapses?: number;
  reviews?: number;
  deckId?: string;
}

export function isReviewQuality(value: unknown): value is ReviewQuality {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 5;
}

/** Throws a RangeError unless `quality` is an integer from 0 to 5. */
export function assertReviewQuality(quality: unknown): asserts quality is ReviewQuality {
  if (!isReviewQuality(quality)) {
    throw new RangeError('Review quality must be an integer from 0 through 5.');
  }
}

function nonNegativeInteger(value: number | undefined): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0;
}

/** Four decimal places, so repeated additions never drift (2.5 + 0.1 is stored as 2.6). */
function roundEase(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function currentEase(state: SrsScheduleInput | undefined): number {
  if (!state || typeof state.ease !== 'number' || !Number.isFinite(state.ease) || state.ease <= 0) return INITIAL_EASE;
  return Math.max(MIN_EASE, state.ease);
}

/** The SM-2 easiness factor after a review of `quality`, starting from `ease`. */
export function nextEase(ease: number, quality: ReviewQuality): number {
  const miss = 5 - quality;
  return Math.max(MIN_EASE, roundEase(ease + (0.1 - miss * (0.08 + miss * 0.02))));
}

/**
 * Schedules a card after a review of `quality` at `now` (epoch ms).
 *
 * `state` is the card's current schedule, or undefined for a card never
 * reviewed. `deckId` is the canonical deck id stored with the state; it
 * defaults to state.deckId (the server action, which has no deck, gets '').
 *
 * Throws a RangeError for a quality outside 0-5 or a non-finite `now`.
 */
export function scheduleReview(
  state: SrsScheduleInput | undefined,
  quality: number,
  now: number,
  deckId: string = state?.deckId ?? '',
): SrsCardState {
  assertReviewQuality(quality);
  if (typeof now !== 'number' || !Number.isFinite(now)) {
    throw new RangeError('Review time must be a finite epoch time in milliseconds.');
  }

  const ease = currentEase(state);
  const previousInterval = state && Number.isFinite(state.interval) && state.interval > 0 ? state.interval : 0;
  let repetitions = nonNegativeInteger(state?.repetitions);
  let lapses = nonNegativeInteger(state?.lapses);
  let interval: number;

  if (quality >= PASSING_QUALITY) {
    if (repetitions === 0) interval = 1;
    else if (repetitions === 1) interval = 6;
    else interval = Math.max(1, Math.round(previousInterval * ease));
    repetitions += 1;
  } else {
    repetitions = 0;
    interval = 1;
    lapses += 1;
  }

  return {
    deckId,
    interval,
    repetitions,
    ease: nextEase(ease, quality),
    dueAt: addDays(now, interval),
    lastReviewedAt: now,
    lapses,
    reviews: nonNegativeInteger(state?.reviews) + 1,
  };
}

/** The interval, in days, a rating of `quality` would give: the hint shown on each rating button. */
export function previewInterval(state: SrsScheduleInput | undefined, quality: number): number {
  return scheduleReview(state, quality, 0).interval;
}

/** "1 day", "6 days". */
export function formatIntervalDays(days: number): string {
  return days === 1 ? '1 day' : `${days} days`;
}
