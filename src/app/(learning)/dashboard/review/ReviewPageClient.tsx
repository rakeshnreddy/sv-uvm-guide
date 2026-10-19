'use client';

import Link from 'next/link';
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';

import { StorageStatusNote } from '@/components/learner/StorageStatusNote';
import { Button } from '@/components/ui/Button';
import { FlashcardFace, RatingGroup } from '@/components/widgets/FlashcardWidget';
import { loadDeck, type FlashcardCard } from '@/lib/flashcard-deck-loaders';
import { useHydrated, useRecord } from '@/lib/learner-store/react';
import { isSameSitePath, writeOutcomeMessage, type WriteOutcome } from '@/lib/learner-store/record';
import { flashcardRecord, type SrsCardState } from '@/lib/learner-store/repositories/flashcards';
import { addDays, localDayKey } from '@/lib/learner-store/time';
import {
  NEW_CARDS_PER_DAY,
  countCardsIntroducedToday,
  dueQueue,
  newCardLane,
  nextReviewAt,
  unreviewedCards,
} from '@/lib/srs/review-queue';
import { clampPosition, localFlashcardReviewStore } from '@/lib/srs/review-store';
import { formatIntervalDays, type ReviewQuality } from '@/lib/srs/scheduler';
import { cn } from '@/lib/utils';

export const FIRST_VISIT_MESSAGE =
  "Rate cards in any lesson's “Reinforce the essentials” section to build your review queue.";

type ReviewLane = 'due' | 'new';

interface ReviewItem {
  cardId: string;
  deckId: string;
  /** Undefined for a new card. */
  state: SrsCardState | undefined;
  lane: ReviewLane;
}

type DeckLoad =
  | { status: 'loading' }
  | { status: 'ready'; cards: ReadonlyMap<string, FlashcardCard> }
  /** Not a deck any more (removed from the content): its cards are skipped. */
  | { status: 'missing' }
  | { status: 'error' };

const panelClass = 'rounded-3xl border border-border/60 bg-card/80 p-5 shadow-sm sm:p-6';
const linkClass =
  'rounded-sm font-semibold text-foreground underline underline-offset-2 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/** Outcomes the learner must hear about inline; 'memory-only' is covered by StorageStatusNote. */
function failureMessage(outcome: WriteOutcome): string | null {
  return outcome === 'memory-only' ? null : writeOutcomeMessage(outcome);
}

// The only kind of lesson link the review page renders. The flashcard record
// already drops other deck lesson hrefs when it reads them; the page checks again.
export { isSameSitePath };

function formatReviewDay(dueAt: number, now: number): string {
  if (!Number.isFinite(new Date(dueAt).getTime())) return 'on a later day';
  if (localDayKey(dueAt) === localDayKey(addDays(now, 1))) return 'tomorrow';
  return new Date(dueAt).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

/**
 * The review queue, built in the browser from the learner's flashcard record:
 * cards due today (oldest first), then today's new cards from decks opened in
 * lessons. It loads only the decks in the queue, refreshes their current card
 * ids, and skips states whose card no longer exists. One card at a time; the
 * learner rates exactly the card shown.
 */
export default function ReviewPageClient() {
  const hydrated = useHydrated();
  const data = useRecord(flashcardRecord);
  const [now, setNow] = useState<number | null>(null);
  const [decks, setDecks] = useState<Readonly<Record<string, DeckLoad>>>({});
  const [index, setIndex] = useState(0);
  const [flippedId, setFlippedId] = useState<string | null>(null);
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [focusPending, setFocusPending] = useState(false);
  const requested = useRef(new Set<string>());
  const mounted = useRef(true);
  const cardRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLHeadingElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const positionId = useId();

  const report = useCallback((outcome: WriteOutcome) => {
    const message = failureMessage(outcome);
    if (message) setNotice(message);
  }, []);

  useEffect(() => {
    mounted.current = true;
    setNow(Date.now());
    return () => {
      mounted.current = false;
    };
  }, []);

  const queue = useMemo<ReviewItem[]>(() => {
    if (now === null) return [];
    const due = dueQueue(data, now).map<ReviewItem>((card) => ({ ...card, lane: 'due' }));
    const fresh = newCardLane(data, now).map<ReviewItem>((card) => ({ ...card, state: undefined, lane: 'new' }));
    return [...due, ...fresh];
  }, [data, now]);

  const neededDecks = useMemo(() => [...new Set(queue.map((item) => item.deckId))].sort().join('\n'), [queue]);

  const startLoad = useCallback(
    (deckId: string) => {
      if (requested.current.has(deckId)) return;
      requested.current.add(deckId);
      setDecks((previous) => ({ ...previous, [deckId]: { status: 'loading' } }));
      loadDeck(deckId).then(
        (deck) => {
          if (!mounted.current) return;
          if (deck === null) {
            setDecks((previous) => ({ ...previous, [deckId]: { status: 'missing' } }));
            report(localFlashcardReviewStore.refreshDeckCards(deckId, []));
            return;
          }
          const cards = new Map(deck.cards.map((card) => [card.id, card]));
          setDecks((previous) => ({ ...previous, [deckId]: { status: 'ready', cards } }));
          report(localFlashcardReviewStore.refreshDeckCards(deckId, [...cards.keys()]));
        },
        () => {
          if (!mounted.current) return;
          requested.current.delete(deckId);
          setDecks((previous) => ({ ...previous, [deckId]: { status: 'error' } }));
        },
      );
    },
    [report],
  );

  // Load the decks the queue needs, one chunk each.
  useEffect(() => {
    if (!neededDecks) return;
    neededDecks.split('\n').forEach(startLoad);
  }, [neededDecks, startLoad]);

  // Cards the content no longer has are skipped even if refreshing the deck's card ids could not be saved.
  const visible = useMemo(
    () =>
      queue.filter((item) => {
        const deck = decks[item.deckId];
        if (!deck) return true;
        if (deck.status === 'missing') return false;
        if (deck.status === 'ready') return deck.cards.has(item.cardId);
        return true;
      }),
    [queue, decks],
  );

  const position = clampPosition(index, visible.length);
  const current = visible[position];

  useEffect(() => {
    if (index !== position) setIndex(position);
  }, [index, position]);

  // A rating or a retry unmounts the focused control. Once the page has re-rendered, focus goes to
  // the card, or to the all-caught-up heading when the queue is empty. While the card's deck is still
  // loading (or failed), focus waits on the card panel and moves to the card when it appears (the
  // card shown and the deck loads are the dependencies). Focus the learner has moved elsewhere in the
  // meantime is left alone.
  useEffect(() => {
    if (!focusPending) return;
    const panel = panelRef.current;
    const active = document.activeElement;
    const held = active === null || active === document.body || (panel !== null && active === panel);
    const target = cardRef.current ?? summaryRef.current;
    if (target) {
      if (held) target.focus();
      setFocusPending(false);
    } else if (held && panel && active !== panel) {
      panel.focus();
    }
  }, [focusPending, current, decks]);

  if (!hydrated || now === null) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Loading your review queue…
      </p>
    );
  }

  const dueCount = visible.filter((item) => item.lane === 'due').length;
  const newCount = visible.length - dueCount;

  const showItem = (nextIndex: number) => {
    setIndex(clampPosition(nextIndex, visible.length));
    setFlippedId(null);
    setRevealedId(null);
    setReviewMessage(null);
  };

  const handleRate = (quality: ReviewQuality) => {
    if (!current) return;
    // The card shown, never the head of the queue.
    const result = localFlashcardReviewStore.rate(current.cardId, current.deckId, quality);
    const failure = failureMessage(result.outcome);
    setFlippedId(null);
    setRevealedId(null);
    setReviewMessage(failure ?? (result.state ? `Next review in ${formatIntervalDays(result.state.interval)}.` : null));
    setFocusPending(true);
  };

  const handleRetry = (deckId: string) => {
    setFocusPending(true);
    startLoad(deckId);
  };

  // The live regions keep one place in the tree whichever view is shown, so screen readers announce what they receive.
  const frame = (body: React.ReactNode) => (
    <div className="flex flex-col gap-4">
      {body}
      <div>
        <p role="status" aria-live="polite" className={cn('text-sm text-foreground', reviewMessage ? '' : 'sr-only')}>
          {reviewMessage}
        </p>
        <p
          role="status"
          aria-live="polite"
          className={cn('text-sm font-medium text-amber-800 dark:text-amber-200', notice ? 'mt-2' : 'sr-only')}
        >
          {notice}
        </p>
      </div>
      <StorageStatusNote />
    </div>
  );

  if (!current) {
    const next = nextReviewAt(data, now);
    const introduced = countCardsIntroducedToday(data, now);
    const moreNewTomorrow = introduced >= NEW_CARDS_PER_DAY && unreviewedCards(data).length > 0;
    return frame(
      <div className={panelClass}>
        {next !== null ? (
          <>
            <h2 ref={summaryRef} tabIndex={-1} className="text-xl font-semibold text-foreground focus-visible:outline-none">
              All caught up — next review {formatReviewDay(next, now)}
            </h2>
            {moreNewTomorrow ? (
              <p className="mt-2 text-sm text-muted-foreground">
                You started {introduced} new cards today. More new cards from your decks arrive tomorrow.
              </p>
            ) : null}
            <p className="mt-2 text-sm text-muted-foreground">
              Keep going in the{' '}
              <Link href="/curriculum" className={linkClass}>
                curriculum
              </Link>
              : every lesson's flashcards can be rated after you flip them.
            </p>
          </>
        ) : (
          <>
            <h2 ref={summaryRef} tabIndex={-1} className="text-xl font-semibold text-foreground focus-visible:outline-none">
              Nothing to review yet
            </h2>
            <p className="mt-2 text-base text-muted-foreground">{FIRST_VISIT_MESSAGE}</p>
            <p className="mt-3">
              <Link href="/curriculum" className={linkClass}>
                Browse the curriculum
              </Link>
            </p>
          </>
        )}
      </div>,
    );
  }

  const deck = decks[current.deckId];
  const card = deck?.status === 'ready' ? deck.cards.get(current.cardId) : undefined;
  const lesson = data.decks[current.deckId]?.lessons[0];
  const lessonHref = lesson && isSameSitePath(lesson.href) ? lesson.href : null;
  const lessonLabel = lesson ? lesson.title || lessonHref : null;
  const flipped = flippedId === current.cardId;
  const revealed = revealedId === current.cardId;

  return frame(
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">{dueCount}</span> due for review ·{' '}
        <span className="font-semibold text-foreground">{newCount}</span> new {newCount === 1 ? 'card' : 'cards'} today
      </p>

      <div
        ref={panelRef}
        role="group"
        aria-labelledby={positionId}
        tabIndex={-1}
        className={cn(panelClass, 'flex flex-col items-center focus-visible:outline-none')}
      >
        <div className="mb-3 flex w-full flex-wrap items-center justify-between gap-2 px-1">
          <span id={positionId} className="text-sm font-medium text-foreground/80">
            Card {position + 1} of {visible.length}
          </span>
          <span
            className={cn(
              'rounded-full px-3 py-1 text-xs font-semibold',
              current.lane === 'due' ? 'bg-primary/10 text-foreground' : 'bg-muted text-foreground',
            )}
          >
            {current.lane === 'due' ? 'Due for review' : 'New card'}
          </span>
        </div>

        {lessonLabel ? (
          <p className="mb-3 w-full px-1 text-sm text-muted-foreground">
            From lesson:{' '}
            {lessonHref ? (
              <Link href={lessonHref} className={linkClass}>
                {lessonLabel}
              </Link>
            ) : (
              <span className="font-semibold text-foreground">{lessonLabel}</span>
            )}
          </p>
        ) : null}

        {card ? (
          <>
            <FlashcardFace
              ref={cardRef}
              front={card.front}
              back={card.back}
              flipped={flipped}
              onFlip={() => {
                setFlippedId(flipped ? null : current.cardId);
                setRevealedId(current.cardId);
              }}
            />
            {revealed ? <RatingGroup state={current.state} onRate={handleRate} /> : null}
          </>
        ) : deck?.status === 'error' ? (
          <div className="mb-4 flex w-full flex-col items-start gap-3 rounded-md border border-border/60 bg-background p-4">
            <p className="text-sm text-foreground">This card's deck couldn't be loaded. Check your connection, then try again.</p>
            <Button type="button" variant="outline" onClick={() => handleRetry(current.deckId)}>
              Try again
            </Button>
          </div>
        ) : (
          <p role="status" className="mb-4 flex h-64 w-full items-center justify-center text-sm text-muted-foreground sm:h-72">
            Loading cards…
          </p>
        )}

        <div className="flex w-full justify-between gap-2">
          <Button
            type="button"
            onClick={() => showItem(position - 1)}
            disabled={position === 0}
            variant="outline"
            aria-label="Previous card"
          >
            <ArrowLeft className="mr-2 h-5 w-5" aria-hidden="true" />
            Previous
          </Button>
          <Button
            type="button"
            onClick={() => showItem(position + 1)}
            disabled={position >= visible.length - 1}
            variant="outline"
            aria-label="Next card"
          >
            Next
            <ArrowRight className="ml-2 h-5 w-5" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>,
  );
}
