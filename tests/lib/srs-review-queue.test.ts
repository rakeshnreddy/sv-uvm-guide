import { describe, expect, it } from 'vitest';

import type { FlashcardData, FlashcardDeckState, SrsCardState } from '@/lib/learner-store/repositories/flashcards';
import { addDays } from '@/lib/learner-store/time';
import {
  NEW_CARDS_PER_DAY,
  countCardsIntroducedToday,
  dueQueue,
  hasReviewHistory,
  newCardLane,
  nextReviewAt,
  unreviewedCards,
  wasFirstReviewedToday,
} from '@/lib/srs/review-queue';

const NOW = new Date(2026, 2, 10, 12, 0, 0).getTime();
const DAY = 24 * 60 * 60 * 1000;

function card(deckId: string, dueAt: number, overrides: Partial<SrsCardState> = {}): SrsCardState {
  return {
    deckId,
    interval: 1,
    repetitions: 1,
    ease: 2.5,
    dueAt,
    lastReviewedAt: dueAt - DAY,
    lapses: 0,
    reviews: 2,
    ...overrides,
  };
}

function deck(cardIds: string[], firstSeenAt: number, overrides: Partial<FlashcardDeckState> = {}): FlashcardDeckState {
  return { lessons: [], cardIds, firstSeenAt, lastSeenAt: firstSeenAt, ...overrides };
}

function data(partial: Partial<FlashcardData>): FlashcardData {
  return { cards: {}, decks: {}, positions: {}, ...partial };
}

describe('dueQueue', () => {
  it('lists cards due by the end of the local day, oldest dueAt first', () => {
    const queue = dueQueue(
      data({
        cards: {
          'a-2': card('deck-a', NOW - 3 * DAY),
          'a-1': card('deck-a', NOW - DAY),
          'b-1': card('deck-b', NOW + 2 * 60 * 60 * 1000),
          'b-2': card('deck-b', NOW + 2 * DAY),
          'a-3': card('deck-a', NOW - 3 * DAY),
        },
        decks: { 'deck-a': deck(['a-1', 'a-2', 'a-3'], 1), 'deck-b': deck(['b-1', 'b-2'], 2) },
      }),
      NOW,
    );
    expect(queue.map((entry) => entry.cardId)).toEqual(['a-2', 'a-3', 'a-1', 'b-1']);
    expect(queue[0]).toMatchObject({ deckId: 'deck-a', state: { dueAt: NOW - 3 * DAY } });
  });

  it('skips orphan states: ids missing from their deck, or a deck that is not enrolled', () => {
    const queue = dueQueue(
      data({
        cards: {
          kept: card('deck-a', NOW - DAY),
          removed: card('deck-a', NOW - DAY),
          'no-deck': card('deck-gone', NOW - DAY),
        },
        decks: { 'deck-a': deck(['kept'], 1) },
      }),
      NOW,
    );
    expect(queue.map((entry) => entry.cardId)).toEqual(['kept']);
  });
});

describe('newCardLane', () => {
  const twoDecks = data({
    decks: {
      later: deck(['l-1', 'l-2'], 200),
      earlier: deck(['e-1', 'e-2', 'e-3'], 100),
    },
  });

  it('takes unreviewed cards from enrolled decks in firstSeenAt order', () => {
    expect(newCardLane(twoDecks, NOW).map((entry) => entry.cardId)).toEqual(['e-1', 'e-2', 'e-3', 'l-1', 'l-2']);
    expect(newCardLane(twoDecks, NOW)[3]).toEqual({ cardId: 'l-1', deckId: 'later' });
  });

  it('skips cards that already have a review state', () => {
    const withReviews = { ...twoDecks, cards: { 'e-2': card('earlier', NOW + 5 * DAY, { lastReviewedAt: NOW - 5 * DAY }) } };
    expect(unreviewedCards(withReviews).map((entry) => entry.cardId)).toEqual(['e-1', 'e-3', 'l-1', 'l-2']);
  });

  it('offers at most ten new cards a day', () => {
    const ids = Array.from({ length: 25 }, (_, index) => `c-${index + 1}`);
    const big = data({ decks: { big: deck(ids, 1) } });
    expect(NEW_CARDS_PER_DAY).toBe(10);
    expect(newCardLane(big, NOW)).toHaveLength(10);
    expect(newCardLane(big, NOW, 3).map((entry) => entry.cardId)).toEqual(['c-1', 'c-2', 'c-3']);
  });

  it('counts cards first reviewed today, anywhere, against the cap', () => {
    const ids = Array.from({ length: 25 }, (_, index) => `c-${index + 1}`);
    const cards: Record<string, SrsCardState> = {};
    // Four cards first reviewed today (one review, today).
    for (const id of ids.slice(0, 4)) cards[id] = card('big', addDays(NOW, 1), { reviews: 1, lastReviewedAt: NOW - 60_000 });
    // An older card reviewed again today does not count.
    cards['c-5'] = card('big', addDays(NOW, 6), { reviews: 2, lastReviewedAt: NOW - 60_000 });
    // A card first reviewed yesterday does not count.
    cards['c-6'] = card('big', NOW, { reviews: 1, lastReviewedAt: NOW - DAY });
    const today = data({ cards, decks: { big: deck(ids, 1) } });

    expect(countCardsIntroducedToday(today, NOW)).toBe(4);
    expect(newCardLane(today, NOW).map((entry) => entry.cardId)).toEqual(['c-7', 'c-8', 'c-9', 'c-10', 'c-11', 'c-12']);
    // The next day the full cap is back.
    expect(newCardLane(today, addDays(NOW, 1))).toHaveLength(10);
  });

  it('is empty once the cap is used up', () => {
    const cards: Record<string, SrsCardState> = {};
    for (let index = 0; index < 10; index += 1) {
      cards[`e-${index}`] = card('earlier', addDays(NOW, 1), { reviews: 1, lastReviewedAt: NOW });
    }
    const used = data({
      cards,
      decks: { earlier: deck([...Object.keys(cards), 'e-new'], 1) },
    });
    expect(newCardLane(used, NOW)).toEqual([]);
  });

  it('knows when a state was first reviewed today', () => {
    expect(wasFirstReviewedToday(card('d', NOW, { reviews: 1, lastReviewedAt: NOW }), NOW)).toBe(true);
    expect(wasFirstReviewedToday(card('d', NOW, { reviews: 1, lastReviewedAt: NOW - DAY }), NOW)).toBe(false);
    expect(wasFirstReviewedToday(card('d', NOW, { reviews: 3, lastReviewedAt: NOW }), NOW)).toBe(false);
  });
});

describe('nextReviewAt and hasReviewHistory', () => {
  it('finds the earliest review after today among live cards', () => {
    const later = data({
      cards: {
        soon: card('deck-a', addDays(NOW, 2)),
        sooner: card('deck-a', addDays(NOW, 1)),
        orphan: card('deck-a', addDays(NOW, 1) - 1000),
        today: card('deck-a', NOW - 1000),
      },
      decks: { 'deck-a': deck(['soon', 'sooner', 'today'], 1) },
    });
    expect(nextReviewAt(later, NOW)).toBe(addDays(NOW, 1));
    expect(hasReviewHistory(later)).toBe(true);
  });

  it('is null with no live states', () => {
    const orphaned = data({ cards: { gone: card('deck-a', addDays(NOW, 3)) }, decks: { 'deck-a': deck([], 1) } });
    expect(nextReviewAt(orphaned, NOW)).toBeNull();
    expect(hasReviewHistory(orphaned)).toBe(false);
    expect(nextReviewAt(data({}), NOW)).toBeNull();
  });
});
