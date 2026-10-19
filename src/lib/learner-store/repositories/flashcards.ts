/**
 * Flashcard review state, keyed by card id and canonical deck id.
 *
 * This is the data contract only; the shared SM-2 scheduler and the review
 * queue (src/lib/srs/*) own the behaviour. Ratings Again, Hard, Good and Easy
 * are qualities 0, 3, 4 and 5. A card is due when dueAt <= endOfLocalDay(now).
 */
import { FLASHCARDS_KEY } from '../keys';
import {
  defineRecord,
  isFiniteNumber,
  isNonEmptyString,
  isNonNegativeInteger,
  isPlainObject,
  isSameSitePath,
  isTimestamp,
  recordOf,
  stringArray,
  timestampOr,
} from '../record';
import { endOfLocalDay } from '../time';

export const FLASHCARDS_MAX_CHARS = 400_000;
/** How many lessons a deck remembers for "back to lesson" links, most recent first. */
export const DECK_LESSONS_MAX = 3;

export interface SrsCardState {
  /** Canonical deck id (aliases resolved on the server). */
  deckId: string;
  /** Days until the next review. */
  interval: number;
  repetitions: number;
  /** SM-2 easiness factor (1.3 or more). */
  ease: number;
  /** Epoch ms. */
  dueAt: number;
  lastReviewedAt: number;
  lapses: number;
  reviews: number;
}

export interface FlashcardDeckLesson {
  href: string;
  title: string;
}

export interface FlashcardDeckState {
  /** Lessons that showed the deck, most recent first, at most DECK_LESSONS_MAX. */
  lessons: FlashcardDeckLesson[];
  /** The deck's current card ids, refreshed whenever a lesson or the review page loads it. */
  cardIds: string[];
  firstSeenAt: number;
  lastSeenAt: number;
}

export interface FlashcardData {
  cards: Record<string, SrsCardState>;
  decks: Record<string, FlashcardDeckState>;
  /** Last card index shown per deck. */
  positions: Record<string, number>;
}

const EMPTY_FLASHCARDS: FlashcardData = Object.freeze({
  cards: Object.freeze({}) as Record<string, SrsCardState>,
  decks: Object.freeze({}) as Record<string, FlashcardDeckState>,
  positions: Object.freeze({}) as Record<string, number>,
});

function parseCardState(value: unknown): SrsCardState | null {
  if (!isPlainObject(value)) return null;
  if (!isNonEmptyString(value.deckId)) return null;
  if (!isFiniteNumber(value.interval) || value.interval < 0) return null;
  if (!isFiniteNumber(value.ease) || value.ease <= 0) return null;
  if (!isTimestamp(value.dueAt)) return null;
  return {
    deckId: value.deckId,
    interval: value.interval,
    repetitions: isNonNegativeInteger(value.repetitions) ? value.repetitions : 0,
    ease: value.ease,
    dueAt: value.dueAt,
    lastReviewedAt: timestampOr(value.lastReviewedAt, 0),
    lapses: isNonNegativeInteger(value.lapses) ? value.lapses : 0,
    reviews: isNonNegativeInteger(value.reviews) ? value.reviews : 0,
  };
}

function parseDeckLessons(value: unknown): FlashcardDeckLesson[] {
  if (!Array.isArray(value)) return [];
  const lessons: FlashcardDeckLesson[] = [];
  for (const item of value) {
    if (!isPlainObject(item) || !isNonEmptyString(item.href) || typeof item.title !== 'string') continue;
    // Only a same-site path is ever a "back to lesson" link (see isSameSitePath).
    if (!isSameSitePath(item.href)) continue;
    if (lessons.some((lesson) => lesson.href === item.href)) continue;
    lessons.push({ href: item.href, title: item.title });
    if (lessons.length === DECK_LESSONS_MAX) break;
  }
  return lessons;
}

function parseDeckState(value: unknown): FlashcardDeckState | null {
  if (!isPlainObject(value)) return null;
  const firstSeenAt = timestampOr(value.firstSeenAt, 0);
  return {
    lessons: parseDeckLessons(value.lessons),
    cardIds: stringArray(value.cardIds),
    firstSeenAt,
    lastSeenAt: timestampOr(value.lastSeenAt, firstSeenAt),
  };
}

export function parseFlashcardData(data: unknown): FlashcardData | null {
  if (!isPlainObject(data)) return null;
  return {
    cards: recordOf(data.cards, parseCardState),
    decks: recordOf(data.decks, parseDeckState),
    positions: recordOf(data.positions, (value) => (isNonNegativeInteger(value) ? value : null)),
  };
}

function mergeDeckState(local: FlashcardDeckState | undefined, incoming: FlashcardDeckState | undefined): FlashcardDeckState {
  if (!local) return incoming as FlashcardDeckState;
  if (!incoming) return local;
  const [primary, secondary] = incoming.lastSeenAt > local.lastSeenAt ? [incoming, local] : [local, incoming];
  const lessons = [...primary.lessons];
  for (const lesson of secondary.lessons) {
    if (lessons.length >= DECK_LESSONS_MAX) break;
    if (!lessons.some((existing) => existing.href === lesson.href)) lessons.push(lesson);
  }
  const firstSeen = [local.firstSeenAt, incoming.firstSeenAt].filter((value) => value > 0);
  return {
    lessons,
    cardIds: [...primary.cardIds],
    firstSeenAt: firstSeen.length > 0 ? Math.min(...firstSeen) : 0,
    lastSeenAt: Math.max(local.lastSeenAt, incoming.lastSeenAt),
  };
}

/** Keeps the newest lastReviewedAt per card; decks keep the current card ids of the one seen last; local positions win. */
export function mergeFlashcardData(local: FlashcardData, incoming: FlashcardData): FlashcardData {
  const cards: Record<string, SrsCardState> = { ...local.cards };
  for (const [cardId, state] of Object.entries(incoming.cards)) {
    const existing = cards[cardId];
    if (!existing || state.lastReviewedAt > existing.lastReviewedAt) cards[cardId] = state;
  }
  const decks: Record<string, FlashcardDeckState> = {};
  for (const deckId of new Set([...Object.keys(local.decks), ...Object.keys(incoming.decks)])) {
    decks[deckId] = mergeDeckState(local.decks[deckId], incoming.decks[deckId]);
  }
  return { cards, decks, positions: { ...incoming.positions, ...local.positions } };
}

export const flashcardRecord = defineRecord<FlashcardData>({
  key: FLASHCARDS_KEY,
  version: 1,
  empty: EMPTY_FLASHCARDS,
  parse: parseFlashcardData,
  maxChars: FLASHCARDS_MAX_CHARS,
  merge: mergeFlashcardData,
});

/** Due when dueAt falls on or before the end of the learner's local day. */
export function isCardDue(state: SrsCardState, now: number = Date.now()): boolean {
  return state.dueAt <= endOfLocalDay(now);
}

/**
 * Due cards, counting only states whose id is among the current card ids of
 * their deck (decks[state.deckId].cardIds), so removed or renamed cards never
 * count. With `deckId`, only that deck.
 */
export function countDueCards(data: FlashcardData, now: number = Date.now(), deckId?: string): number {
  const cutoff = endOfLocalDay(now);
  const currentIds = new Map<string, Set<string>>();
  let due = 0;
  for (const [cardId, state] of Object.entries(data.cards)) {
    if (deckId !== undefined && state.deckId !== deckId) continue;
    if (state.dueAt > cutoff) continue;
    let ids = currentIds.get(state.deckId);
    if (!ids) {
      ids = new Set(data.decks[state.deckId]?.cardIds ?? []);
      currentIds.set(state.deckId, ids);
    }
    if (ids.has(cardId)) due += 1;
  }
  return due;
}
