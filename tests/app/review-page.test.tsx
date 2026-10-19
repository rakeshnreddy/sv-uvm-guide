import React from 'react';
import { renderToString } from 'react-dom/server';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ReviewPageClient, { FIRST_VISIT_MESSAGE, isSameSitePath } from '@/app/(learning)/dashboard/review/ReviewPageClient';
import FlashcardReviewPage, { metadata } from '@/app/(learning)/dashboard/review/page';
import type { DeckCards } from '@/lib/flashcard-deck-loaders';
import { FLASHCARDS_KEY } from '@/lib/learner-store/keys';
import { __resetRecordsForTests } from '@/lib/learner-store/record';
import { flashcardRecord, type SrsCardState } from '@/lib/learner-store/repositories/flashcards';
import { __resetStorageForTests } from '@/lib/learner-store/storage';

const loader = vi.hoisted(() => ({
  decks: new Map<string, DeckCards>(),
  calls: [] as string[],
  fail: new Set<string>(),
  /** Decks whose download waits until the test resolves the gate. */
  gates: new Map<string, Promise<void>>(),
}));

vi.mock('@/lib/flashcard-deck-loaders', () => ({
  loadDeck: async (deckId: string) => {
    loader.calls.push(deckId);
    await loader.gates.get(deckId);
    if (loader.fail.has(deckId)) throw new Error('chunk failed');
    return loader.decks.get(deckId) ?? null;
  },
}));

const DAY = 24 * 60 * 60 * 1000;
const storage = window.localStorage;
const LESSON = { href: '/curriculum/T3_Advanced/B-AMBA-1_Protocol_Families_and_Tradeoffs/index', title: 'AMBA Protocol Families' };

const DECK_A: DeckCards = {
  deckId: 'deck-a',
  cards: [
    { id: 'a-1', front: 'Question A1', back: 'Answer A1' },
    { id: 'a-2', front: 'Question A2', back: 'Answer A2' },
    { id: 'a-3', front: 'Question A3', back: 'Answer A3' },
    { id: 'a-4', front: 'Question A4', back: 'Answer A4' },
  ],
};

function state(dueAt: number, overrides: Partial<SrsCardState> = {}): SrsCardState {
  return {
    deckId: 'deck-a',
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

function seed(data: unknown) {
  storage.setItem(FLASHCARDS_KEY, JSON.stringify({ v: 1, data }));
}

/** a-2 due two days ago, a-1 due yesterday, a-3 due in five days, a-4 never rated. */
function seedQueue() {
  const now = Date.now();
  seed({
    cards: {
      'a-1': state(now - DAY),
      'a-2': state(now - 2 * DAY),
      'a-3': state(now + 5 * DAY),
    },
    decks: { 'deck-a': { lessons: [LESSON], cardIds: ['a-1', 'a-2', 'a-3', 'a-4'], firstSeenAt: now - 10 * DAY, lastSeenAt: now - DAY } },
    positions: {},
  });
}

function card() {
  return screen.getByTestId('flashcard-front').closest('[role="button"]') as HTMLElement;
}

function rate(label: 'Again' | 'Hard' | 'Good' | 'Easy') {
  fireEvent.click(card());
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${label},`) }));
}

beforeEach(() => {
  __resetStorageForTests();
  __resetRecordsForTests();
  storage.clear();
  loader.decks = new Map([['deck-a', DECK_A]]);
  loader.calls = [];
  loader.fail = new Set();
  loader.gates = new Map();
  // framer-motion uses layout effects under jsdom; React warns about them during renderToString.
  const originalError = console.error;
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('useLayoutEffect does nothing on the server')) return;
    originalError(...args);
  });
});

afterEach(() => {
  cleanup();
  storage.clear();
  __resetStorageForTests();
  __resetRecordsForTests();
  vi.restoreAllMocks();
});

describe('/dashboard/review page shell', () => {
  it('is a static shell with the review heading and the learner navigation', () => {
    expect(metadata.title).toBe('Flashcard review');
    const html = renderToString(<FlashcardReviewPage />);
    expect(html).toMatch(/<h1[^>]*>Flashcard review<\/h1>/);
    expect(html).toContain('aria-label="Your learning"');
    const reviewLink = html.match(/<a[^>]*href="\/dashboard\/review"[^>]*>/)?.[0] ?? '';
    expect(reviewLink).toContain('aria-current="page"');
    expect(html).toContain('Loading your review queue');
  });
});

describe('ReviewPageClient', () => {
  it('explains how to build the queue on a first visit', async () => {
    render(<ReviewPageClient />);
    expect(await screen.findByText(FIRST_VISIT_MESSAGE)).toBeInTheDocument();
    expect(FIRST_VISIT_MESSAGE).toBe("Rate cards in any lesson's “Reinforce the essentials” section to build your review queue.");
    expect(screen.getByRole('link', { name: 'Browse the curriculum' })).toHaveAttribute('href', '/curriculum');
    expect(screen.getByText('Saved in this browser')).toBeInTheDocument();
    expect(loader.calls).toEqual([]);
  });

  it('lists due cards oldest first, then new cards, with a link back to the lesson', async () => {
    seedQueue();
    render(<ReviewPageClient />);
    expect(await screen.findByText('Question A2')).toBeInTheDocument();
    expect(screen.getByText('Card 1 of 3')).toBeInTheDocument();
    expect(screen.getByText('Due for review')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: LESSON.title })).toHaveAttribute('href', LESSON.href);
    expect(screen.getByText(/From lesson:/)).toBeInTheDocument();
    expect(loader.calls).toEqual(['deck-a']);

    fireEvent.click(screen.getByRole('button', { name: 'Next card' }));
    expect(screen.getByText('Question A1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next card' }));
    expect(screen.getByText('Question A4')).toBeInTheDocument();
    expect(screen.getByText('New card')).toBeInTheDocument();
  });

  it('rates the card shown after pressing Next, not the head of the queue', async () => {
    seedQueue();
    const before = flashcardRecord.read().cards['a-2'];
    render(<ReviewPageClient />);
    await screen.findByText('Question A2');

    fireEvent.click(screen.getByRole('button', { name: 'Next card' }));
    expect(screen.getByText('Question A1')).toBeInTheDocument();
    rate('Good');

    const after = flashcardRecord.read().cards;
    expect(after['a-1']).toMatchObject({ repetitions: 2, interval: 6, reviews: 3 });
    expect(after['a-2']).toEqual(before);
    expect(screen.getByText('Next review in 6 days.')).toBeInTheDocument();
    // a-1 left the queue; the index stays, so the next card (a-4) is shown.
    expect(screen.getByText('Card 2 of 2')).toBeInTheDocument();
    expect(screen.getByText('Question A4')).toBeInTheDocument();
    expect(card()).toHaveFocus();
  });

  it('does not crash after rating the last card, and clamps the index', async () => {
    seedQueue();
    render(<ReviewPageClient />);
    await screen.findByText('Question A2');
    fireEvent.click(screen.getByRole('button', { name: 'Next card' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next card' }));
    expect(screen.getByText('Card 3 of 3')).toBeInTheDocument();
    rate('Easy');

    expect(flashcardRecord.read().cards['a-4']).toMatchObject({ repetitions: 1, reviews: 1 });
    expect(screen.getByText('Card 2 of 2')).toBeInTheDocument();
    expect(screen.getByText('Question A1')).toBeInTheDocument();
  });

  it('is all caught up once every card is rated, naming the next review day', async () => {
    seedQueue();
    render(<ReviewPageClient />);
    await screen.findByText('Question A2');
    rate('Again');
    rate('Good');
    rate('Good');
    expect(screen.getByRole('heading', { name: 'All caught up — next review tomorrow' })).toHaveFocus();
    expect(flashcardRecord.read().cards['a-2']).toMatchObject({ lapses: 1, repetitions: 0 });
  });

  it('skips orphan states and refreshes the card ids of loaded decks', async () => {
    const now = Date.now();
    seed({
      cards: {
        'a-1': state(now - DAY),
        // Listed in the stored deck, but the deck content no longer has it.
        'a-old': state(now - 3 * DAY),
        // Not listed in its deck at all.
        'a-orphan': state(now - 4 * DAY),
      },
      decks: { 'deck-a': { lessons: [LESSON], cardIds: ['a-1', 'a-old'], firstSeenAt: now - 10 * DAY, lastSeenAt: now } },
      positions: {},
    });
    render(<ReviewPageClient />);
    expect(await screen.findByText('Question A1')).toBeInTheDocument();
    expect(flashcardRecord.read().decks['deck-a'].cardIds).toEqual(['a-1', 'a-2', 'a-3', 'a-4']);
    // a-1 is due; a-2, a-3 and a-4 are new; a-old and a-orphan are gone.
    expect(screen.getByText('Card 1 of 4')).toBeInTheDocument();
  });

  it('skips the cards of a deck that no longer exists', async () => {
    const now = Date.now();
    seed({
      cards: { 'gone-1': state(now - DAY, { deckId: 'deck-gone' }) },
      decks: { 'deck-gone': { lessons: [], cardIds: ['gone-1'], firstSeenAt: now - DAY, lastSeenAt: now - DAY } },
      positions: {},
    });
    render(<ReviewPageClient />);
    expect(await screen.findByText(FIRST_VISIT_MESSAGE)).toBeInTheDocument();
    expect(flashcardRecord.read().decks['deck-gone'].cardIds).toEqual([]);
  });

  it('shows a loading state, then offers a retry when a deck cannot be downloaded', async () => {
    seedQueue();
    loader.fail.add('deck-a');
    render(<ReviewPageClient />);
    expect(screen.getByText('Loading cards…')).toBeInTheDocument();
    expect(await screen.findByText(/couldn't be loaded/)).toBeInTheDocument();

    loader.fail.clear();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    });
    expect(await screen.findByText('Question A2')).toBeInTheDocument();
  });
  it('moves focus to the card panel while the next card is loading, then to the card', async () => {
    const now = Date.now();
    seed({
      cards: {
        'a-1': state(now - 2 * DAY),
        'b-1': state(now - DAY, { deckId: 'deck-b' }),
      },
      decks: {
        'deck-a': { lessons: [LESSON], cardIds: ['a-1'], firstSeenAt: now - 10 * DAY, lastSeenAt: now - DAY },
        'deck-b': { lessons: [], cardIds: ['b-1'], firstSeenAt: now - 10 * DAY, lastSeenAt: now - DAY },
      },
      positions: {},
    });
    loader.decks.set('deck-a', { deckId: 'deck-a', cards: [DECK_A.cards[0]] });
    loader.decks.set('deck-b', { deckId: 'deck-b', cards: [{ id: 'b-1', front: 'Question B1', back: 'Answer B1' }] });
    let release: () => void = () => {};
    loader.gates.set('deck-b', new Promise<void>((resolve) => (release = resolve)));

    render(<ReviewPageClient />);
    await screen.findByText('Question A1');
    fireEvent.click(card());
    const good = screen.getByRole('button', { name: /^Good,/ });
    good.focus();
    fireEvent.click(good);

    expect(screen.getByText('Loading cards…')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Card 1 of 1' })).toHaveFocus();

    await act(async () => {
      release();
    });
    expect(await screen.findByText('Question B1')).toBeInTheDocument();
    expect(card()).toHaveFocus();
  });

  it('keeps focus on the page when Try again replaces the error with the loading state', async () => {
    seedQueue();
    loader.fail.add('deck-a');
    render(<ReviewPageClient />);
    const retry = await screen.findByRole('button', { name: 'Try again' });

    loader.fail.clear();
    let release: () => void = () => {};
    loader.gates.set('deck-a', new Promise<void>((resolve) => (release = resolve)));
    retry.focus();
    fireEvent.click(retry);
    expect(screen.getByText('Loading cards…')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Card 1 of 3' })).toHaveFocus();

    await act(async () => {
      release();
    });
    expect(await screen.findByText('Question A2')).toBeInTheDocument();
    expect(card()).toHaveFocus();
  });

  it('does not take focus back after the learner moved it while a card was loading', async () => {
    const now = Date.now();
    seed({
      cards: {
        'a-1': state(now - 2 * DAY),
        'b-1': state(now - DAY, { deckId: 'deck-b' }),
      },
      decks: {
        'deck-a': { lessons: [LESSON], cardIds: ['a-1'], firstSeenAt: now - 10 * DAY, lastSeenAt: now - DAY },
        'deck-b': { lessons: [LESSON], cardIds: ['b-1'], firstSeenAt: now - 10 * DAY, lastSeenAt: now - DAY },
      },
      positions: {},
    });
    loader.decks.set('deck-a', { deckId: 'deck-a', cards: [DECK_A.cards[0]] });
    loader.decks.set('deck-b', { deckId: 'deck-b', cards: [{ id: 'b-1', front: 'Question B1', back: 'Answer B1' }] });
    let release: () => void = () => {};
    loader.gates.set('deck-b', new Promise<void>((resolve) => (release = resolve)));

    render(<ReviewPageClient />);
    await screen.findByText('Question A1');
    rate('Good');
    expect(screen.getByRole('group', { name: 'Card 1 of 1' })).toHaveFocus();
    const lessonLink = screen.getByRole('link', { name: LESSON.title });
    lessonLink.focus();

    await act(async () => {
      release();
    });
    expect(await screen.findByText('Question B1')).toBeInTheDocument();
    expect(lessonLink).toHaveFocus();
  });

  it('never links a stored lesson that is not a same-site path (the record drops it on read)', async () => {
    const now = Date.now();
    seed({
      cards: { 'a-1': state(now - DAY) },
      decks: {
        'deck-a': {
          lessons: [{ href: 'javascript:alert(document.domain)', title: 'Crafted lesson' }],
          cardIds: ['a-1'],
          firstSeenAt: now - 10 * DAY,
          lastSeenAt: now - DAY,
        },
      },
      positions: {},
    });
    loader.decks.set('deck-a', { deckId: 'deck-a', cards: [DECK_A.cards[0]] });
    render(<ReviewPageClient />);
    await screen.findByText('Question A1');
    // parseDeckLessons keeps only same-site paths, so the crafted entry never reaches the page.
    expect(screen.queryByText(/From lesson:/)).toBeNull();
    expect(screen.queryByText('Crafted lesson')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Crafted lesson' })).toBeNull();
    expect(document.querySelector('a[href^="javascript:"]')).toBeNull();
  });

  it('accepts only same-site paths as lesson links', () => {
    expect(isSameSitePath(LESSON.href)).toBe(true);
    expect(isSameSitePath('/curriculum')).toBe(true);
    for (const href of [
      'javascript:alert(1)',
      'JavaScript:alert(1)',
      ' /curriculum',
      '//evil.example/path',
      '/\\evil.example',
      '/\t/evil.example',
      '/\n/evil.example',
      'https://evil.example/',
      'data:text/html,hi',
      'curriculum/T1',
      '',
    ]) {
      expect(isSameSitePath(href), href).toBe(false);
    }
  });
});
