/**
 * FlashcardReviewStore: where flashcard ratings, deck enrollment and the
 * last-viewed card of each deck are saved.
 *
 * The lesson widget and the review page talk only to this interface, never to
 * storage or server actions directly. Today there is one implementation, the
 * local store over the learner store's flashcard record (this browser's
 * localStorage). An account-backed store can implement the same interface
 * later, behind the server action reviewFlashcard, which uses the same
 * scheduler.
 *
 * Every write goes through flashcardRecord.update(fn), which re-reads storage
 * first, so two open tabs never overwrite each other's ratings. Methods never
 * throw for storage problems; they return the record's WriteOutcome (anything
 * but 'saved' should be shown to the learner). Card states are keyed by card
 * id and canonical deck id (aliases are resolved on the server).
 */
import {
  DECK_LESSONS_MAX,
  flashcardRecord,
  type FlashcardData,
  type FlashcardDeckLesson,
  type FlashcardDeckState,
  type SrsCardState,
} from '@/lib/learner-store/repositories/flashcards';
import { recordActivity, type ActivityKind } from '@/lib/learner-store/repositories/activity';
import type { LearnerRecord, WriteOutcome } from '@/lib/learner-store/record';
import { assertReviewQuality, scheduleReview } from '@/lib/srs/scheduler';

export interface RatingResult {
  outcome: WriteOutcome;
  /** The card's new schedule; null when nothing was saved (the write was refused, or not in a browser). */
  state: SrsCardState | null;
}

export interface FlashcardReviewStore {
  /**
   * Records that a lesson showed this deck: refreshes the deck's current card
   * ids and puts `lesson` first in its lessons (most recent first, at most
   * three). Writes nothing when nothing changes. `lesson` null refreshes the
   * card ids only.
   */
  enrollDeck(deckId: string, lesson: FlashcardDeckLesson | null, cardIds: readonly string[], now?: number): WriteOutcome;
  /** Refreshes the current card ids of a deck that is already enrolled (the review page after loading it). */
  refreshDeckCards(deckId: string, cardIds: readonly string[]): WriteOutcome;
  /** Schedules `cardId` after a review of `quality` (0-5; throws RangeError otherwise) and counts a review for today. */
  rate(cardId: string, deckId: string, quality: number, now?: number): RatingResult;
  /** Remembers the card index last shown for a deck. */
  setPosition(deckId: string, index: number): WriteOutcome;
  /** The card index last shown for a deck, or 0. Callers clamp it to the deck's size. */
  getPosition(deckId: string): number;
}

function uniqueIds(cardIds: readonly string[]): string[] {
  const seen = new Set<string>();
  for (const id of cardIds) {
    if (typeof id === 'string' && id.length > 0) seen.add(id);
  }
  return [...seen];
}

function sameStrings(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function sameLessons(a: readonly FlashcardDeckLesson[], b: readonly FlashcardDeckLesson[]): boolean {
  return a.length === b.length && a.every((lesson, index) => lesson.href === b[index].href && lesson.title === b[index].title);
}

/** `lesson` first, then the other lessons in their order, at most DECK_LESSONS_MAX. */
export function withLessonFirst(
  lessons: readonly FlashcardDeckLesson[],
  lesson: FlashcardDeckLesson,
): FlashcardDeckLesson[] {
  return [{ href: lesson.href, title: lesson.title }, ...lessons.filter((entry) => entry.href !== lesson.href)].slice(
    0,
    DECK_LESSONS_MAX,
  );
}

export interface LocalReviewStoreOptions {
  record?: LearnerRecord<FlashcardData>;
  /** Counts one review on the learner's local day (the activity record by default). */
  recordActivity?: (kind: ActivityKind, now?: number) => WriteOutcome;
}

/** The browser implementation, over the learner store's flashcard record. */
export function createLocalFlashcardReviewStore(options: LocalReviewStoreOptions = {}): FlashcardReviewStore {
  const record = options.record ?? flashcardRecord;
  const countActivity = options.recordActivity ?? recordActivity;

  return {
    enrollDeck(deckId, lesson, cardIds, now = Date.now()) {
      const ids = uniqueIds(cardIds);
      const visit = lesson && lesson.href ? { href: lesson.href, title: lesson.title ?? '' } : null;
      return record.update((data) => {
        const existing = data.decks[deckId];
        if (!existing) {
          const deck: FlashcardDeckState = {
            lessons: visit ? [visit] : [],
            cardIds: ids,
            firstSeenAt: now,
            lastSeenAt: now,
          };
          return { ...data, decks: { ...data.decks, [deckId]: deck } };
        }
        const lessons = visit ? withLessonFirst(existing.lessons, visit) : existing.lessons;
        const idsChanged = !sameStrings(existing.cardIds, ids);
        const lessonsChanged = !sameLessons(existing.lessons, lessons);
        if (!idsChanged && !lessonsChanged) return data;
        const deck: FlashcardDeckState = {
          ...existing,
          lessons,
          cardIds: idsChanged ? ids : existing.cardIds,
          lastSeenAt: Math.max(existing.lastSeenAt, now),
        };
        return { ...data, decks: { ...data.decks, [deckId]: deck } };
      });
    },

    refreshDeckCards(deckId, cardIds) {
      const ids = uniqueIds(cardIds);
      return record.update((data) => {
        const existing = data.decks[deckId];
        if (!existing || sameStrings(existing.cardIds, ids)) return data;
        return { ...data, decks: { ...data.decks, [deckId]: { ...existing, cardIds: ids } } };
      });
    },

    rate(cardId, deckId, quality, now = Date.now()) {
      assertReviewQuality(quality);
      let next: SrsCardState | null = null;
      const outcome = record.update((data) => {
        next = scheduleReview(data.cards[cardId], quality, now, deckId);
        return { ...data, cards: { ...data.cards, [cardId]: next } };
      });
      const saved = outcome === 'saved' || outcome === 'memory-only';
      if (saved) countActivity('review', now);
      return { outcome, state: saved ? next : null };
    },

    setPosition(deckId, index) {
      const position = Number.isInteger(index) && index > 0 ? index : 0;
      return record.update((data) => {
        if ((data.positions[deckId] ?? 0) === position) return data;
        return { ...data, positions: { ...data.positions, [deckId]: position } };
      });
    },

    getPosition(deckId) {
      const position = record.read().positions[deckId];
      return typeof position === 'number' && Number.isInteger(position) && position > 0 ? position : 0;
    },
  };
}

/** The store learner pages use. Local while SERVER_SYNC_READY is false, so even signed-in learners keep ratings here. */
export const localFlashcardReviewStore: FlashcardReviewStore = createLocalFlashcardReviewStore();

/** Clamps a saved position to a deck of `size` cards. */
export function clampPosition(position: number, size: number): number {
  if (size <= 0 || !Number.isFinite(position)) return 0;
  return Math.min(Math.max(0, Math.trunc(position)), size - 1);
}
