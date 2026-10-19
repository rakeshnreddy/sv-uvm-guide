import fs from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';
import React from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import tailwindcss from 'tailwindcss';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import FlashcardWidget, { END_OF_DECK_MESSAGE, RATING_GROUP_LABEL } from '@/components/widgets/FlashcardWidget';
import { FLASHCARDS_KEY } from '@/lib/learner-store/keys';
import { __resetRecordsForTests } from '@/lib/learner-store/record';
import { activityRecord } from '@/lib/learner-store/repositories/activity';
import { flashcardRecord } from '@/lib/learner-store/repositories/flashcards';
import { __resetStorageForTests } from '@/lib/learner-store/storage';
import { localDayKey } from '@/lib/learner-store/time';

const LESSON_PATH = '/curriculum/T3_Advanced/B-AMBA-1_Protocol_Families_and_Tradeoffs/index';
const pathname = vi.hoisted(() => ({ value: '/curriculum/T3_Advanced/B-AMBA-1_Protocol_Families_and_Tradeoffs/index' as string | null }));

vi.mock('next/navigation', () => ({
  usePathname: () => pathname.value,
}));

const DECK_ID = 'B-AMBA-1_Protocol_Families_and_Tradeoffs';
const CARDS = [
  { id: 'fw-1', front: 'When is AHB-Lite a better fit than AXI4?', back: 'A single-master subsystem.' },
  { id: 'fw-2', front: 'What does AXI4-Stream drop?', back: 'Addresses.' },
  { id: 'fw-3', front: 'Which protocol adds coherency?', back: 'ACE.' },
];

const storage = window.localStorage;

/** The utilities the 3D flip needs; without them the back face (the answer, mirrored) covers the question. */
const PERSPECTIVE = '[perspective:1000px]';
const PRESERVE_3D = '[transform-style:preserve-3d]';
const BACKFACE_HIDDEN = ['[backface-visibility:hidden]', '[-webkit-backface-visibility:hidden]'];

function renderWidget(props: Partial<React.ComponentProps<typeof FlashcardWidget>> = {}) {
  return render(<FlashcardWidget deckId={DECK_ID} cards={CARDS} lessonTitle="AMBA Protocol Families" {...props} />);
}

function card() {
  return screen.getByTestId('flashcard-front').closest('[role="button"]') as HTMLElement;
}

function seedFlashcards(data: unknown) {
  storage.setItem(FLASHCARDS_KEY, JSON.stringify({ v: 1, data }));
}

beforeEach(() => {
  __resetStorageForTests();
  __resetRecordsForTests();
  storage.clear();
  pathname.value = LESSON_PATH;
  // framer-motion uses layout effects under jsdom; React warns about them during renderToString.
  const originalError = console.error;
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('useLayoutEffect does nothing on the server')) return;
    originalError(...args);
  });
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
  storage.clear();
  __resetStorageForTests();
  __resetRecordsForTests();
  vi.restoreAllMocks();
});

describe('FlashcardWidget', () => {
  it('renders the first card on the server, with no placeholder and no <section>', () => {
    const html = renderToString(<FlashcardWidget deckId={DECK_ID} cards={CARDS} lessonTitle="AMBA" />);
    expect(html).toContain('When is AHB-Lite a better fit than AXI4?');
    expect(html).toMatch(/Card <!-- -->1<!-- --> of <!-- -->3/);
    expect(html).not.toContain('No flashcards available');
    expect(html).not.toContain('<section');
    expect(html).not.toContain(RATING_GROUP_LABEL);
    expect(html).not.toContain('due for review');
    // Not clickable until hydrated, so a click before hydration is not lost.
    expect(html).toContain('aria-disabled="true"');
  });

  it('writes nothing during the server render', () => {
    renderToString(<FlashcardWidget deckId={DECK_ID} cards={CARDS} />);
    expect(storage.getItem(FLASHCARDS_KEY)).toBeNull();
  });

  it('hydrates the server markup without a mismatch', () => {
    const html = renderToString(<FlashcardWidget deckId={DECK_ID} cards={CARDS} lessonTitle="AMBA" />);
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);
    const onRecoverableError = vi.fn();
    let root: Root | undefined;
    act(() => {
      root = hydrateRoot(container, <FlashcardWidget deckId={DECK_ID} cards={CARDS} lessonTitle="AMBA" />, {
        onRecoverableError,
      });
    });
    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(container.querySelector('[role="button"]')?.getAttribute('aria-disabled')).toBeNull();
    act(() => root?.unmount());
  });

  it('keeps the card as the first explicit role=button, and flipping toggles aria-pressed', () => {
    const { container } = renderWidget();
    const first = container.querySelector('[role="button"]');
    expect(first).toBe(card());
    expect(card()).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(card());
    expect(card()).toHaveAttribute('aria-pressed', 'true');
    fireEvent.keyDown(card(), { key: 'Enter' });
    expect(card()).toHaveAttribute('aria-pressed', 'false');
    fireEvent.keyDown(card(), { key: ' ' });
    expect(card()).toHaveAttribute('aria-pressed', 'true');
    expect(container.querySelector('section')).toBeNull();
  });

  it('uses 3D flip utilities that exist, so the question face hides the answer until a flip', () => {
    renderWidget();
    const container = card();
    const front = screen.getByTestId('flashcard-front');
    const back = screen.getByTestId('flashcard-back');
    const rotor = front.parentElement as HTMLElement;
    expect(rotor.parentElement).toBe(container);
    expect(back.parentElement).toBe(rotor);

    expect(container.classList).toContain(PERSPECTIVE);
    expect(rotor.classList).toContain(PRESERVE_3D);
    for (const face of [front, back]) {
      for (const name of BACKFACE_HIDDEN) expect(face.classList).toContain(name);
    }
    expect(back.classList).toContain('[transform:rotateY(180deg)]');
    // The class names globals.css no longer defines are gone.
    for (const element of [container, rotor, front, back]) {
      for (const stale of ['perspective', 'preserve-3d', 'backface-hidden']) expect(element.classList).not.toContain(stale);
    }
  });

  it('lets the card grow with its text: both faces share one grid cell and nothing is absolutely positioned', () => {
    renderWidget();
    const container = card();
    const front = screen.getByTestId('flashcard-front');
    const back = screen.getByTestId('flashcard-back');
    const rotor = front.parentElement as HTMLElement;
    expect(rotor.classList).toContain('grid');
    expect(rotor.classList).toContain('min-h-64');
    for (const element of [container, rotor]) {
      expect(element.className).not.toMatch(/(^|\s)(sm:)?h-(64|72|full)(\s|$)/);
    }
    for (const face of [front, back]) {
      expect(face.classList).toContain('col-start-1');
      expect(face.classList).toContain('row-start-1');
      expect(face.classList).not.toContain('absolute');
      expect(face.className).not.toMatch(/(^|\s)h-full(\s|$)/);
    }
  });

  it('generates CSS for every flip and layout utility it uses', async () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'src/components/widgets/FlashcardWidget.tsx'), 'utf8');
    const { css } = await postcss([tailwindcss({ content: [{ raw: source, extension: 'tsx' }] })]).process(
      '@tailwind utilities;',
      { from: undefined },
    );
    const declarations = css.replace(/\s+/g, ' ');
    for (const rule of [
      'perspective: 1000px',
      'transform-style: preserve-3d',
      '-webkit-backface-visibility: hidden',
      'backface-visibility: hidden',
      'transform: rotateY(180deg)',
      'min-height: 16rem',
      'grid-column-start: 1',
      'grid-row-start: 1',
    ]) {
      expect(declarations).toContain(rule);
    }
  });

  it('shows the rating group only after a flip, with interval hints', () => {
    renderWidget();
    expect(screen.queryByRole('group', { name: RATING_GROUP_LABEL })).toBeNull();
    fireEvent.click(card());
    const group = screen.getByRole('group', { name: RATING_GROUP_LABEL });
    const names = within(group)
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label'));
    expect(names).toEqual([
      'Again, next review in 1 day',
      'Hard, next review in 1 day',
      'Good, next review in 1 day',
      'Easy, next review in 1 day',
    ]);
  });

  it('enrolls the deck after mount with this lesson and the current card ids', () => {
    renderWidget();
    expect(flashcardRecord.read().decks[DECK_ID]).toMatchObject({
      lessons: [{ href: LESSON_PATH, title: 'AMBA Protocol Families' }],
      cardIds: ['fw-1', 'fw-2', 'fw-3'],
    });
  });

  it('enrolls without a lesson when there is no pathname', () => {
    pathname.value = null;
    renderWidget();
    expect(flashcardRecord.read().decks[DECK_ID]).toMatchObject({ lessons: [], cardIds: ['fw-1', 'fw-2', 'fw-3'] });
  });

  it('rating saves the card, announces the next review and moves to the next card', () => {
    renderWidget();
    fireEvent.click(card());
    fireEvent.click(screen.getByRole('button', { name: /^Good/ }));

    expect(screen.getByText('Card 2 of 3')).toBeInTheDocument();
    expect(screen.getByText('What does AXI4-Stream drop?')).toBeInTheDocument();
    expect(screen.getByText('Next review in 1 day.')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: RATING_GROUP_LABEL })).toBeNull();
    expect(card()).toHaveAttribute('aria-pressed', 'false');
    expect(card()).toHaveFocus();

    const saved = flashcardRecord.read();
    expect(saved.cards['fw-1']).toMatchObject({ deckId: DECK_ID, interval: 1, repetitions: 1, reviews: 1 });
    expect(saved.positions[DECK_ID]).toBe(1);
    expect(activityRecord.read().days[localDayKey(Date.now())]).toEqual({ review: 1 });
  });

  it('shows the end of the deck after rating the last card', () => {
    seedFlashcards({ cards: {}, decks: {}, positions: { [DECK_ID]: 2 } });
    renderWidget();
    expect(screen.getByText('Card 3 of 3')).toBeInTheDocument();
    fireEvent.click(card());
    fireEvent.click(screen.getByRole('button', { name: /^Again/ }));
    expect(screen.getByText(END_OF_DECK_MESSAGE)).toBeInTheDocument();
    expect(screen.getByText('Next review in 1 day.')).toBeInTheDocument();
    expect(screen.getByText('Card 3 of 3')).toBeInTheDocument();
    expect(flashcardRecord.read().cards['fw-3']).toMatchObject({ lapses: 1 });

    fireEvent.click(screen.getByRole('button', { name: 'Restart flashcards' }));
    expect(screen.getByText('Card 1 of 3')).toBeInTheDocument();
    expect(screen.queryByText(END_OF_DECK_MESSAGE)).toBeNull();
    expect(flashcardRecord.read().positions[DECK_ID]).toBe(0);
  });

  it('restores the saved position after mount, clamped to the deck', () => {
    seedFlashcards({ cards: {}, decks: {}, positions: { [DECK_ID]: 2 } });
    const { unmount } = renderWidget();
    expect(screen.getByText('Card 3 of 3')).toBeInTheDocument();
    unmount();

    seedFlashcards({ cards: {}, decks: {}, positions: { [DECK_ID]: 40 } });
    renderWidget();
    expect(screen.getByText('Card 3 of 3')).toBeInTheDocument();
  });

  it('Next and Previous save the position, which survives a remount', () => {
    const { unmount } = renderWidget();
    fireEvent.click(screen.getByRole('button', { name: 'Next card' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next card' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous card' }));
    expect(screen.getByText('Card 2 of 3')).toBeInTheDocument();
    expect(flashcardRecord.read().positions[DECK_ID]).toBe(1);
    unmount();

    renderWidget();
    expect(screen.getByText('Card 2 of 3')).toBeInTheDocument();
  });

  it('links to the review page when cards are due', () => {
    const yesterday = Date.now() - 24 * 60 * 60 * 1000;
    seedFlashcards({
      cards: {
        'fw-1': { deckId: DECK_ID, interval: 1, repetitions: 1, ease: 2.5, dueAt: yesterday, lastReviewedAt: yesterday, lapses: 0, reviews: 1 },
        'other-1': { deckId: 'other', interval: 1, repetitions: 1, ease: 2.5, dueAt: yesterday, lastReviewedAt: yesterday, lapses: 0, reviews: 1 },
        // An orphan: its deck no longer lists it, so it never counts.
        'gone-1': { deckId: 'other', interval: 1, repetitions: 1, ease: 2.5, dueAt: yesterday, lastReviewedAt: yesterday, lapses: 0, reviews: 1 },
      },
      decks: { other: { lessons: [], cardIds: ['other-1'], firstSeenAt: 1, lastSeenAt: 1 } },
      positions: {},
    });
    renderWidget();
    const link = screen.getByRole('link', { name: '2 due for review' });
    expect(link).toHaveAttribute('href', '/dashboard/review');
  });

  it('shows no due link when nothing is due', () => {
    renderWidget();
    expect(screen.queryByRole('link', { name: /due for review/ })).toBeNull();
  });

  it('says so when a deck has no cards', () => {
    const html = renderToString(<FlashcardWidget deckId="empty" cards={[]} />);
    expect(html).toContain('This lesson has no flashcards yet.');
    expect(html).not.toContain('role="button"');
  });

  it('shows an inline message when a rating cannot be saved', () => {
    storage.setItem(FLASHCARDS_KEY, JSON.stringify({ v: 99, data: {} }));
    renderWidget();
    fireEvent.click(card());
    fireEvent.click(screen.getByRole('button', { name: /^Easy/ }));
    expect(screen.getAllByText(/Not saved: this data was saved by a newer version of the site/).length).toBeGreaterThan(0);
    expect(screen.getByText('Card 2 of 3')).toBeInTheDocument();
  });
});
