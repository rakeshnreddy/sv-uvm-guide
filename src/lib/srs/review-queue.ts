/**
 * Builds the review page's queues from the learner's flashcard record.
 *
 * Pure and client-safe. Only card states whose id is among the current card
 * ids of their deck (decks[state.deckId].cardIds, refreshed whenever a lesson
 * or the review page loads the deck) are used, so cards removed or renamed in
 * the content never show up or count (the same rule as countDueCards).
 */
import {
  isCardDue,
  type FlashcardData,
  type SrsCardState,
} from '@/lib/learner-store/repositories/flashcards';
import { endOfLocalDay, startOfLocalDay } from '@/lib/learner-store/time';

/** New cards the review page offers per local day, counting cards first reviewed today anywhere. */
export const NEW_CARDS_PER_DAY = 10;

export interface DueCard {
  cardId: string;
  deckId: string;
  state: SrsCardState;
}

export interface NewCard {
  cardId: string;
  deckId: string;
}

/** Each deck's current card ids as a Set, built once per call. */
function currentCardIds(data: FlashcardData): (deckId: string) => ReadonlySet<string> {
  const cache = new Map<string, ReadonlySet<string>>();
  return (deckId) => {
    let ids = cache.get(deckId);
    if (!ids) {
      ids = new Set(data.decks[deckId]?.cardIds ?? []);
      cache.set(deckId, ids);
    }
    return ids;
  };
}

/** Every state whose card is still in its deck, in no particular order. */
function liveStates(data: FlashcardData): DueCard[] {
  const idsOf = currentCardIds(data);
  const live: DueCard[] = [];
  for (const [cardId, state] of Object.entries(data.cards)) {
    if (idsOf(state.deckId).has(cardId)) live.push({ cardId, deckId: state.deckId, state });
  }
  return live;
}

/** True when `state` was reviewed for the first time on `now`'s local day. */
export function wasFirstReviewedToday(state: SrsCardState, now: number): boolean {
  // The state keeps no first-review time. A card with exactly one review, made
  // today, was certainly first reviewed today; a new card rated several times
  // today in a lesson is not counted, so the daily cap can only err generously.
  return state.reviews === 1 && state.lastReviewedAt >= startOfLocalDay(now) && state.lastReviewedAt <= endOfLocalDay(now);
}

/** Cards due by the end of the learner's local day, oldest dueAt first (ties by card id). */
export function dueQueue(data: FlashcardData, now: number): DueCard[] {
  return liveStates(data)
    .filter((entry) => isCardDue(entry.state, now))
    .sort((a, b) => a.state.dueAt - b.state.dueAt || (a.cardId < b.cardId ? -1 : a.cardId > b.cardId ? 1 : 0));
}

/** How many cards, still in their decks, were first reviewed today. */
export function countCardsIntroducedToday(data: FlashcardData, now: number): number {
  return liveStates(data).filter((entry) => wasFirstReviewedToday(entry.state, now)).length;
}

/** Unreviewed cards of the enrolled decks, decks in firstSeenAt order (ties by deck id), cards in deck order. */
export function unreviewedCards(data: FlashcardData): NewCard[] {
  const decks = Object.entries(data.decks).sort(
    ([idA, a], [idB, b]) => a.firstSeenAt - b.firstSeenAt || (idA < idB ? -1 : idA > idB ? 1 : 0),
  );
  const seen = new Set<string>();
  const cards: NewCard[] = [];
  for (const [deckId, deck] of decks) {
    for (const cardId of deck.cardIds) {
      if (seen.has(cardId) || data.cards[cardId]) continue;
      seen.add(cardId);
      cards.push({ cardId, deckId });
    }
  }
  return cards;
}

/**
 * Today's new cards: unreviewed cards from enrolled decks (decks in the order
 * they were first seen), at most `cap` a day. Cards first reviewed today, in a
 * lesson or here, count against the cap.
 */
export function newCardLane(data: FlashcardData, now: number, cap: number = NEW_CARDS_PER_DAY): NewCard[] {
  const remaining = Math.max(0, Math.floor(cap) - countCardsIntroducedToday(data, now));
  if (remaining === 0) return [];
  return unreviewedCards(data).slice(0, remaining);
}

/** The earliest dueAt after today among cards still in their decks, or null when nothing is scheduled. */
export function nextReviewAt(data: FlashcardData, now: number): number | null {
  const cutoff = endOfLocalDay(now);
  let next: number | null = null;
  for (const { state } of liveStates(data)) {
    if (state.dueAt > cutoff && (next === null || state.dueAt < next)) next = state.dueAt;
  }
  return next;
}

/** True when the learner has rated at least one card that is still in its deck. */
export function hasReviewHistory(data: FlashcardData): boolean {
  return liveStates(data).length > 0;
}
