import { describe, expect, it } from 'vitest';

import { isCardDue, type SrsCardState } from '@/lib/learner-store/repositories/flashcards';
import { addDays, endOfLocalDay } from '@/lib/learner-store/time';
import {
  INITIAL_EASE,
  MIN_EASE,
  RATINGS,
  assertReviewQuality,
  formatIntervalDays,
  isReviewQuality,
  nextEase,
  previewInterval,
  scheduleReview,
} from '@/lib/srs/scheduler';

/** 10:00 local time, so adding days never crosses a day boundary by accident. */
const NOW = new Date(2026, 2, 2, 10, 0, 0).getTime();

function reviewSeries(qualities: number[], start = NOW): SrsCardState[] {
  const states: SrsCardState[] = [];
  let state: SrsCardState | undefined;
  let now = start;
  for (const quality of qualities) {
    state = scheduleReview(state, quality, now, 'deck-a');
    states.push(state);
    now = state.dueAt;
  }
  return states;
}

describe('SM-2 scheduler', () => {
  it('maps Again, Hard, Good and Easy to qualities 0, 3, 4 and 5', () => {
    expect(RATINGS.map((rating) => [rating.label, rating.q])).toEqual([
      ['Again', 0],
      ['Hard', 3],
      ['Good', 4],
      ['Easy', 5],
    ]);
  });

  it('starts a new card at interval 1, then 6, then round(interval x EF)', () => {
    const [first, second, third, fourth] = reviewSeries([4, 4, 4, 4]);
    expect(first).toMatchObject({ deckId: 'deck-a', interval: 1, repetitions: 1, ease: INITIAL_EASE, lapses: 0, reviews: 1 });
    expect(second).toMatchObject({ interval: 6, repetitions: 2, reviews: 2 });
    expect(third).toMatchObject({ interval: Math.round(6 * 2.5), repetitions: 3, reviews: 3 });
    expect(fourth.interval).toBe(Math.round(third.interval * third.ease));
  });

  it('uses the ease before this review for the interval, then updates the ease', () => {
    const second = reviewSeries([5, 5])[1];
    expect(second.ease).toBe(2.7);
    const third = scheduleReview(second, 5, second.dueAt);
    expect(third.interval).toBe(Math.round(6 * 2.7));
    expect(third.ease).toBe(2.8);
  });

  it('treats Hard (3) as a pass that lowers the ease', () => {
    const state = scheduleReview(undefined, 3, NOW, 'deck-a');
    expect(state).toMatchObject({ interval: 1, repetitions: 1, lapses: 0 });
    expect(state.ease).toBe(2.36);
    const next = scheduleReview(state, 3, state.dueAt);
    expect(next).toMatchObject({ interval: 6, repetitions: 2, lapses: 0 });
  });

  it('resets a failed card to interval 1 and counts a lapse', () => {
    const [, , passed] = reviewSeries([4, 4, 4]);
    expect(passed.repetitions).toBe(3);
    const failed = scheduleReview(passed, 0, passed.dueAt);
    expect(failed).toMatchObject({ interval: 1, repetitions: 0, lapses: 1, reviews: 4 });
    expect(failed.ease).toBe(1.7);
    expect(failed.dueAt).toBe(addDays(passed.dueAt, 1));
    const again = scheduleReview(failed, 2, failed.dueAt);
    expect(again).toMatchObject({ interval: 1, repetitions: 0, lapses: 2 });
  });

  it('never lets the ease fall below 1.3', () => {
    const states = reviewSeries([0, 0, 0, 0, 0, 0]);
    expect(states.map((state) => state.ease)).toEqual([1.7, MIN_EASE, MIN_EASE, MIN_EASE, MIN_EASE, MIN_EASE]);
    expect(nextEase(1.3, 3)).toBe(MIN_EASE);
    expect(scheduleReview({ interval: 10, repetitions: 4, ease: 0.9 }, 4, NOW).interval).toBe(Math.round(10 * MIN_EASE));
  });

  it('applies the SM-2 ease formula for every quality', () => {
    for (const q of [0, 1, 2, 3, 4, 5] as const) {
      const miss = 5 - q;
      const expected = Math.max(MIN_EASE, Math.round((2.5 + 0.1 - miss * (0.08 + miss * 0.02)) * 10_000) / 10_000);
      expect(nextEase(2.5, q)).toBe(expected);
    }
  });

  it('rejects qualities that are not integers from 0 to 5', () => {
    for (const quality of [-1, 6, 2.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => scheduleReview(undefined, quality, NOW)).toThrow(RangeError);
      expect(isReviewQuality(quality)).toBe(false);
    }
    expect(() => assertReviewQuality('4')).toThrow('Review quality must be an integer from 0 through 5.');
    expect(() => scheduleReview(undefined, 4, Number.NaN)).toThrow(RangeError);
    expect(isReviewQuality(0)).toBe(true);
    expect(isReviewQuality(5)).toBe(true);
  });

  it('sets dueAt to now plus the interval in local days and records the review time', () => {
    const state = scheduleReview(undefined, 4, NOW, 'deck-a');
    expect(state.lastReviewedAt).toBe(NOW);
    expect(state.dueAt).toBe(addDays(NOW, 1));
    const second = scheduleReview(state, 4, NOW);
    expect(second.dueAt).toBe(addDays(NOW, 6));
  });

  it('makes a card due from the start of its due day (the local-day boundary)', () => {
    const lateEvening = new Date(2026, 2, 2, 23, 30).getTime();
    const state = scheduleReview(undefined, 4, lateEvening, 'deck-a');
    // Due 23:30 tomorrow, but due all of tomorrow, from just after midnight.
    const justAfterMidnight = new Date(2026, 2, 3, 0, 5).getTime();
    expect(state.dueAt).toBeGreaterThan(justAfterMidnight);
    expect(isCardDue(state, justAfterMidnight)).toBe(true);
    expect(isCardDue(state, lateEvening)).toBe(false);
    expect(isCardDue(state, endOfLocalDay(lateEvening))).toBe(false);
  });

  it('keeps the deck id of the state unless a new one is given', () => {
    const state = scheduleReview(undefined, 4, NOW, 'deck-a');
    expect(scheduleReview(state, 4, NOW).deckId).toBe('deck-a');
    expect(scheduleReview(state, 4, NOW, 'deck-b').deckId).toBe('deck-b');
    expect(scheduleReview({ interval: 1, repetitions: 0, ease: 2.5 }, 4, NOW).deckId).toBe('');
  });

  it('previews the interval each rating would give', () => {
    expect(RATINGS.map((rating) => previewInterval(undefined, rating.q))).toEqual([1, 1, 1, 1]);
    const once = scheduleReview(undefined, 4, NOW, 'deck-a');
    expect(RATINGS.map((rating) => previewInterval(once, rating.q))).toEqual([1, 6, 6, 6]);
    const twice = scheduleReview(once, 4, NOW);
    expect(RATINGS.map((rating) => previewInterval(twice, rating.q))).toEqual([1, 15, 15, 15]);
    expect(formatIntervalDays(1)).toBe('1 day');
    expect(formatIntervalDays(6)).toBe('6 days');
  });
});
