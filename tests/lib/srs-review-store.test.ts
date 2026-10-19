import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FLASHCARDS_KEY, recoveredKeyFor } from '@/lib/learner-store/keys';
import { __resetRecordsForTests } from '@/lib/learner-store/record';
import { activityRecord } from '@/lib/learner-store/repositories/activity';
import { countDueCards, flashcardRecord } from '@/lib/learner-store/repositories/flashcards';
import { __resetStorageForTests } from '@/lib/learner-store/storage';
import { addDays, localDayKey } from '@/lib/learner-store/time';
import { dueQueue } from '@/lib/srs/review-queue';
import {
  clampPosition,
  createLocalFlashcardReviewStore,
  localFlashcardReviewStore,
  withLessonFirst,
} from '@/lib/srs/review-store';

const NOW = new Date(2026, 2, 10, 9, 0, 0).getTime();
const storage = window.localStorage;

const lessonA = { href: '/curriculum/T3_Advanced/B-AMBA-1_Protocol_Families_and_Tradeoffs/index', title: 'AMBA families' };
const lessonB = { href: '/curriculum/T1_Foundational/F2_Data_Types/index', title: 'Data types' };

function storedFlashcards(): { v: number; data: Record<string, unknown> } | null {
  const raw = storage.getItem(FLASHCARDS_KEY);
  return raw === null ? null : JSON.parse(raw);
}

beforeEach(() => {
  __resetStorageForTests();
  __resetRecordsForTests();
  storage.clear();
});

afterEach(() => {
  storage.clear();
  __resetStorageForTests();
  __resetRecordsForTests();
  vi.restoreAllMocks();
});

describe('enrollDeck', () => {
  it('creates the deck with its card ids, lesson and first-seen time', () => {
    expect(localFlashcardReviewStore.enrollDeck('deck-a', lessonA, ['a-1', 'a-2', 'a-1'], NOW)).toBe('saved');
    expect(flashcardRecord.read().decks['deck-a']).toEqual({
      lessons: [lessonA],
      cardIds: ['a-1', 'a-2'],
      firstSeenAt: NOW,
      lastSeenAt: NOW,
    });
  });

  it('writes nothing when nothing changes', () => {
    localFlashcardReviewStore.enrollDeck('deck-a', lessonA, ['a-1', 'a-2'], NOW);
    const raw = storage.getItem(FLASHCARDS_KEY);
    const setItem = vi.spyOn(storage, 'setItem');

    expect(localFlashcardReviewStore.enrollDeck('deck-a', lessonA, ['a-1', 'a-2'], addDays(NOW, 3))).toBe('saved');
    expect(localFlashcardReviewStore.enrollDeck('deck-a', null, ['a-1', 'a-2'], addDays(NOW, 4))).toBe('saved');

    expect(setItem).not.toHaveBeenCalled();
    expect(storage.getItem(FLASHCARDS_KEY)).toBe(raw);
  });

  it('refreshes card ids and keeps the most recent lessons first, at most three', () => {
    const store = localFlashcardReviewStore;
    store.enrollDeck('shared', lessonA, ['s-1'], NOW);
    store.enrollDeck('shared', lessonB, ['s-1', 's-2'], NOW + 1000);
    let deck = flashcardRecord.read().decks.shared;
    expect(deck.lessons.map((lesson) => lesson.href)).toEqual([lessonB.href, lessonA.href]);
    expect(deck.cardIds).toEqual(['s-1', 's-2']);
    expect(deck).toMatchObject({ firstSeenAt: NOW, lastSeenAt: NOW + 1000 });

    store.enrollDeck('shared', lessonA, ['s-1', 's-2'], NOW + 2000);
    store.enrollDeck('shared', { href: '/c', title: 'C' }, ['s-1', 's-2'], NOW + 3000);
    store.enrollDeck('shared', { href: '/d', title: 'D' }, ['s-1', 's-2'], NOW + 4000);
    deck = flashcardRecord.read().decks.shared;
    expect(deck.lessons.map((lesson) => lesson.href)).toEqual(['/d', '/c', lessonA.href]);
  });

  it('puts a lesson first without duplicating it', () => {
    expect(withLessonFirst([lessonA, lessonB], { href: lessonB.href, title: 'Renamed' })).toEqual([
      { href: lessonB.href, title: 'Renamed' },
      lessonA,
    ]);
  });
});

describe('rate', () => {
  it('saves the schedule, counts a review for today and makes the card due on its day', () => {
    const store = localFlashcardReviewStore;
    store.enrollDeck('deck-a', lessonA, ['a-1', 'a-2'], NOW);
    const result = store.rate('a-1', 'deck-a', 4, NOW);

    expect(result.outcome).toBe('saved');
    expect(result.state).toMatchObject({ deckId: 'deck-a', interval: 1, repetitions: 1, reviews: 1, lastReviewedAt: NOW });
    expect(storedFlashcards()?.data).toMatchObject({ cards: { 'a-1': { interval: 1, dueAt: addDays(NOW, 1) } } });
    expect(activityRecord.read().days[localDayKey(NOW)]).toEqual({ review: 1 });

    expect(countDueCards(flashcardRecord.read(), NOW)).toBe(0);
    expect(countDueCards(flashcardRecord.read(), addDays(NOW, 2))).toBe(1);
    expect(dueQueue(flashcardRecord.read(), addDays(NOW, 2)).map((entry) => entry.cardId)).toEqual(['a-1']);
  });

  it('builds on the stored state, so a rating persists across a remount', () => {
    localFlashcardReviewStore.enrollDeck('deck-a', lessonA, ['a-1'], NOW);
    localFlashcardReviewStore.rate('a-1', 'deck-a', 4, NOW);

    // A fresh store (a new page load) reads the saved state back.
    __resetRecordsForTests();
    const reloaded = createLocalFlashcardReviewStore();
    const second = reloaded.rate('a-1', 'deck-a', 4, addDays(NOW, 1));
    expect(second.state).toMatchObject({ interval: 6, repetitions: 2, reviews: 2 });
    expect(flashcardRecord.read().cards['a-1']).toMatchObject({ interval: 6, repetitions: 2 });
  });

  it('keeps ratings written by another tab', () => {
    localFlashcardReviewStore.enrollDeck('deck-a', lessonA, ['a-1', 'a-2'], NOW);
    localFlashcardReviewStore.rate('a-1', 'deck-a', 4, NOW);
    // Another tab rates a-2 and writes storage directly.
    const otherTab = storedFlashcards() as { v: number; data: { cards: Record<string, unknown> } };
    otherTab.data.cards['a-2'] = { ...(otherTab.data.cards['a-1'] as object), lastReviewedAt: NOW + 5 };
    storage.setItem(FLASHCARDS_KEY, JSON.stringify(otherTab));

    localFlashcardReviewStore.rate('a-1', 'deck-a', 5, NOW + 10);
    expect(Object.keys(flashcardRecord.read().cards).sort()).toEqual(['a-1', 'a-2']);
  });

  it('throws for an invalid quality and writes nothing', () => {
    expect(() => localFlashcardReviewStore.rate('a-1', 'deck-a', 7, NOW)).toThrow(RangeError);
    expect(storage.getItem(FLASHCARDS_KEY)).toBeNull();
  });

  it('recovers from a corrupt store: reads as empty, keeps a copy, then saves the rating', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    storage.setItem(FLASHCARDS_KEY, '{not json');

    expect(localFlashcardReviewStore.getPosition('deck-a')).toBe(0);
    expect(flashcardRecord.read().cards).toEqual({});

    expect(localFlashcardReviewStore.enrollDeck('deck-a', lessonA, ['a-1'], NOW)).toBe('saved');
    expect(storage.getItem(recoveredKeyFor(FLASHCARDS_KEY))).toBe('{not json');
    expect(localFlashcardReviewStore.rate('a-1', 'deck-a', 3, NOW).outcome).toBe('saved');
    expect(flashcardRecord.read().cards['a-1']).toMatchObject({ repetitions: 1 });
    expect(warn).toHaveBeenCalled();
  });

  it('refuses to overwrite data saved by a newer version of the site', () => {
    const newer = JSON.stringify({ v: 99, data: { anything: true } });
    storage.setItem(FLASHCARDS_KEY, newer);
    const result = localFlashcardReviewStore.rate('a-1', 'deck-a', 4, NOW);
    expect(result).toEqual({ outcome: 'blocked-newer-version', state: null });
    expect(storage.getItem(FLASHCARDS_KEY)).toBe(newer);
    expect(activityRecord.read().days).toEqual({});
  });
});

describe('refreshDeckCards', () => {
  it('updates the card ids of an enrolled deck so removed cards stop counting', () => {
    const store = localFlashcardReviewStore;
    store.enrollDeck('deck-a', lessonA, ['a-1', 'a-2'], NOW);
    store.rate('a-1', 'deck-a', 0, NOW);
    store.rate('a-2', 'deck-a', 0, NOW);
    const later = addDays(NOW, 1);
    expect(countDueCards(flashcardRecord.read(), later)).toBe(2);

    expect(store.refreshDeckCards('deck-a', ['a-2', 'a-3'])).toBe('saved');
    expect(flashcardRecord.read().decks['deck-a'].cardIds).toEqual(['a-2', 'a-3']);
    expect(countDueCards(flashcardRecord.read(), later)).toBe(1);
    expect(dueQueue(flashcardRecord.read(), later).map((entry) => entry.cardId)).toEqual(['a-2']);
  });

  it('does not create decks that were never enrolled', () => {
    expect(localFlashcardReviewStore.refreshDeckCards('deck-x', ['x-1'])).toBe('saved');
    expect(storage.getItem(FLASHCARDS_KEY)).toBeNull();
  });
});

describe('positions', () => {
  it('saves and restores the last card shown per deck, writing only on change', () => {
    const store = localFlashcardReviewStore;
    expect(store.getPosition('deck-a')).toBe(0);
    expect(store.setPosition('deck-a', 0)).toBe('saved');
    expect(storage.getItem(FLASHCARDS_KEY)).toBeNull();

    store.setPosition('deck-a', 3);
    store.setPosition('deck-b', 1);
    expect(store.getPosition('deck-a')).toBe(3);
    expect(store.getPosition('deck-b')).toBe(1);
    store.setPosition('deck-a', -2);
    expect(store.getPosition('deck-a')).toBe(0);
  });

  it('clamps a saved position to the deck size', () => {
    expect(clampPosition(7, 5)).toBe(4);
    expect(clampPosition(-1, 5)).toBe(0);
    expect(clampPosition(2, 0)).toBe(0);
    expect(clampPosition(Number.NaN, 3)).toBe(0);
  });
});
