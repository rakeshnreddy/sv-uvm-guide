"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";

import { StorageStatusNote } from "@/components/learner/StorageStatusNote";
import { Button } from "@/components/ui/Button";
import type { FlashcardCard } from "@/lib/flashcard-deck-loaders";
import { useHydrated, useRecord } from "@/lib/learner-store/react";
import { writeOutcomeMessage, type WriteOutcome } from "@/lib/learner-store/record";
import { countDueCards, flashcardRecord, type SrsCardState } from "@/lib/learner-store/repositories/flashcards";
import { clampPosition, localFlashcardReviewStore } from "@/lib/srs/review-store";
import { RATINGS, formatIntervalDays, previewInterval, type ReviewQuality } from "@/lib/srs/scheduler";
import { cn } from "@/lib/utils";

export const RATING_GROUP_LABEL = "How well did you recall this card?";
export const END_OF_DECK_MESSAGE = "You reached the end of this deck.";

const cardVariants = {
  front: { rotateY: 0 },
  back: { rotateY: 180 },
};

/**
 * The 3D flip uses arbitrary utilities: globals.css has no perspective or
 * backface classes. Both faces share one grid cell (no absolute positioning),
 * so the taller side sets the card's height and a long answer never spills
 * over the rating buttons below.
 */
const faceClass =
  "relative col-start-1 row-start-1 flex min-w-0 items-center justify-center p-6 rounded-md shadow-md border border-border/30 bg-background [backface-visibility:hidden] [-webkit-backface-visibility:hidden]";

const dueLinkClass =
  "inline-flex min-h-[2.75rem] items-center rounded-full border border-primary/40 bg-primary/10 px-4 text-sm font-semibold text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** Outcomes the learner must hear about inline; 'memory-only' is covered by StorageStatusNote. */
function failureMessage(outcome: WriteOutcome): string | null {
  return outcome === "memory-only" ? null : writeOutcomeMessage(outcome);
}

/** The canonical lesson path: no trailing slash (query and hash are never part of usePathname). */
function lessonPathFrom(pathname: string | null): string | null {
  if (!pathname || !pathname.startsWith("/")) return null;
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed.length > 0 ? trimmed : "/";
}

export interface FlashcardFaceProps {
  front: string;
  back: string;
  flipped: boolean;
  onFlip: () => void;
  /** True until the page has hydrated, so the server-rendered card is not clickable before it works. */
  disabled?: boolean;
}

/**
 * The flip card: an explicit role="button" with aria-pressed (pressed shows the
 * answer). Its accessible name is the side being shown; the hidden side is
 * aria-hidden. Enter and Space flip it while it has focus.
 */
export const FlashcardFace = React.forwardRef<HTMLDivElement, FlashcardFaceProps>(function FlashcardFace(
  { front, back, flipped, onFlip, disabled = false },
  ref,
) {
  return (
    <div
      ref={ref}
      className="w-full [perspective:1000px] bg-transparent cursor-pointer mb-4 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background aria-disabled:cursor-default"
      onClick={disabled ? undefined : onFlip}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (disabled || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        onFlip();
      }}
      aria-pressed={flipped}
      aria-disabled={disabled || undefined}
    >
      <motion.div
        className="grid w-full grid-cols-1 min-h-64 sm:min-h-72 [transform-style:preserve-3d]"
        animate={flipped ? "back" : "front"}
        variants={cardVariants}
        transition={{ duration: 0.6 }}
      >
        <motion.div className={faceClass} aria-hidden={flipped || undefined} data-testid="flashcard-front">
          <div className="w-full min-w-0 break-words text-center text-lg text-foreground">
            <span className="sr-only">Question: </span>
            {front}
          </div>
        </motion.div>
        <motion.div
          className={`${faceClass} [transform:rotateY(180deg)]`}
          aria-hidden={!flipped || undefined}
          data-testid="flashcard-back"
        >
          <div className="w-full min-w-0 break-words text-center text-base text-foreground/90">
            <span className="sr-only">Answer: </span>
            {back}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
});

export interface RatingGroupProps {
  /** The card's current schedule (undefined for a card never rated), for the interval hints. */
  state: SrsCardState | undefined;
  onRate: (quality: ReviewQuality) => void;
  disabled?: boolean;
}

/** Again, Hard, Good and Easy (qualities 0, 3, 4 and 5), each with the interval it would give. */
export function RatingGroup({ state, onRate, disabled = false }: RatingGroupProps) {
  const labelId = useId();
  return (
    <div role="group" aria-labelledby={labelId} className="mb-4 w-full">
      <p id={labelId} className="mb-2 text-sm font-medium text-foreground">
        {RATING_GROUP_LABEL}
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {RATINGS.map((rating) => {
          const hint = formatIntervalDays(previewInterval(state, rating.q));
          return (
            <Button
              key={rating.label}
              type="button"
              variant="outline"
              disabled={disabled}
              onClick={() => onRate(rating.q)}
              aria-label={`${rating.label}, next review in ${hint}`}
              className="h-auto min-h-[2.75rem] flex-col gap-0.5 py-2"
            >
              <span>{rating.label}</span>
              <span className="text-xs font-normal text-muted-foreground">{hint}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}

interface FlashcardWidgetProps {
  /** Canonical deck id, resolved on the server (getDeckCards). */
  deckId: string;
  /** This deck's cards, in deck order; the first one is server-rendered. */
  cards: readonly FlashcardCard[];
  /** The lesson's title, kept with the deck so the review page can link back. */
  lessonTitle?: string;
}

/**
 * A lesson's flashcards. The first card is rendered on the server. After
 * mount the widget restores the deck's last position (clamped) and enrolls
 * the deck in the local review queue; after a flip the learner can rate the
 * card, which schedules it (SM-2) and moves on. Everything is saved in this
 * browser through the FlashcardReviewStore; nothing is written during the
 * server render.
 */
const FlashcardWidget: React.FC<FlashcardWidgetProps> = ({ deckId, cards, lessonTitle }) => {
  const pathname = usePathname() as string | null;
  const lessonPath = lessonPathFrom(pathname);
  const hydrated = useHydrated();
  const data = useRecord(flashcardRecord);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const cardIdsKey = cards.map((card) => card.id).join("\n");
  const deckSize = cards.length;

  const report = useCallback((outcome: WriteOutcome) => {
    const message = failureMessage(outcome);
    if (message) setNotice(message);
  }, []);

  // Restore the last card shown for this deck (never during the server render).
  useEffect(() => {
    if (deckSize === 0) return;
    setCurrentIndex(clampPosition(localFlashcardReviewStore.getPosition(deckId), deckSize));
    setIsFlipped(false);
    setRevealed(false);
    setFinished(false);
    setReviewMessage(null);
    setNotice(null);
  }, [deckId, deckSize]);

  // Enroll the deck: refreshes its card ids and puts this lesson first. Writes only when something changes.
  useEffect(() => {
    if (cardIdsKey.length === 0) return;
    const lesson = lessonPath ? { href: lessonPath, title: lessonTitle ?? "" } : null;
    report(localFlashcardReviewStore.enrollDeck(deckId, lesson, cardIdsKey.split("\n")));
  }, [deckId, cardIdsKey, lessonPath, lessonTitle, report]);

  if (deckSize === 0) {
    return (
      <div className="my-6 p-5 rounded-lg shadow-md bg-secondary/20 dark:bg-secondary/10 border border-border/30 text-center">
        <p className="text-foreground/80">This lesson has no flashcards yet.</p>
      </div>
    );
  }

  const index = clampPosition(currentIndex, deckSize);
  const currentCard = cards[index];
  const progressPercentage = ((index + 1) / deckSize) * 100;
  const dueCount = hydrated ? countDueCards(data, Date.now()) : 0;

  const showCard = (nextIndex: number) => {
    const target = clampPosition(nextIndex, deckSize);
    setCurrentIndex(target);
    setIsFlipped(false);
    setRevealed(false);
    setFinished(false);
    setReviewMessage(null);
    report(localFlashcardReviewStore.setPosition(deckId, target));
  };

  const handleNext = () => {
    if (index < deckSize - 1) showCard(index + 1);
  };

  const handlePrevious = () => {
    if (index > 0) showCard(index - 1);
  };

  const handleRestart = () => showCard(0);

  const handleFlip = () => {
    setIsFlipped((flipped) => !flipped);
    setRevealed(true);
  };

  const handleRate = (quality: ReviewQuality) => {
    const result = localFlashcardReviewStore.rate(currentCard.id, deckId, quality);
    const failure = failureMessage(result.outcome);
    const scheduled = result.state ? `Next review in ${formatIntervalDays(result.state.interval)}.` : null;
    if (index < deckSize - 1) {
      showCard(index + 1);
    } else {
      setIsFlipped(false);
      setRevealed(false);
      setFinished(true);
    }
    setReviewMessage(failure ?? scheduled);
    cardRef.current?.focus();
  };

  return (
    <div className="my-6 p-4 sm:p-6 rounded-lg shadow-xl bg-card border border-border/50 flex flex-col items-center w-full max-w-lg mx-auto">
      {/* Header: Counter and Restart Button */}
      <div className="w-full flex justify-between items-center mb-3 px-1">
        <span className="text-sm font-medium text-foreground/80">
          Card {index + 1} of {deckSize}
        </span>
        <Button variant="ghost" size="sm" onClick={handleRestart} disabled={!hydrated} aria-label="Restart flashcards">
          <RefreshCw className="w-4 h-4 mr-1 sm:mr-2" aria-hidden="true" />
          Restart
        </Button>
      </div>

      <FlashcardFace
        ref={cardRef}
        front={currentCard.front}
        back={currentCard.back}
        flipped={isFlipped}
        onFlip={handleFlip}
        disabled={!hydrated}
      />

      {revealed ? <RatingGroup state={data.cards[currentCard.id]} onRate={handleRate} /> : null}

      {/* Progress Bar */}
      <div className="w-full h-2 bg-muted rounded-full overflow-hidden mb-4">
        <motion.div
          className="h-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${progressPercentage}%` }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        />
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between w-full gap-2">
        <Button onClick={handlePrevious} disabled={!hydrated || index === 0} variant="outline" aria-label="Previous card">
          <ArrowLeft className="w-5 h-5 mr-2" aria-hidden="true" />
          Previous
        </Button>
        <Button onClick={handleNext} disabled={!hydrated || index === deckSize - 1} variant="outline" aria-label="Next card">
          Next
          <ArrowRight className="w-5 h-5 ml-2" aria-hidden="true" />
        </Button>
      </div>

      {/* Live regions stay mounted (visually hidden while empty) so screen readers announce what they receive. */}
      <p
        role="status"
        aria-live="polite"
        className={cn("w-full text-sm text-muted-foreground", reviewMessage || finished ? "mt-3" : "sr-only")}
      >
        {reviewMessage ? <span>{reviewMessage}</span> : null}
        {reviewMessage && finished ? " " : null}
        {finished ? <span>{END_OF_DECK_MESSAGE}</span> : null}
      </p>
      <p
        role="status"
        aria-live="polite"
        className={cn("w-full text-sm font-medium text-amber-800 dark:text-amber-200", notice ? "mt-2" : "sr-only")}
      >
        {notice}
      </p>

      <div className="mt-3 flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <StorageStatusNote savedLabel="Ratings are kept in this browser." />
        {dueCount > 0 ? (
          <Link href="/dashboard/review" className={dueLinkClass}>
            {dueCount} due for review
          </Link>
        ) : null}
      </div>
    </div>
  );
};

export default FlashcardWidget;
