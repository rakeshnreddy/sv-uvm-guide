import type { Metadata } from 'next';
import React from 'react';

import { LearnerSectionNav } from '@/components/learner/LearnerSectionNav';

import ReviewPageClient from './ReviewPageClient';

export const metadata: Metadata = {
  title: 'Flashcard review',
  description:
    'Review the lesson flashcards that are due today, oldest first, plus a few new cards from decks you have opened. Your review queue is stored only in this browser.',
};

/**
 * The flashcard review queue. A static shell: the queue itself is built in the
 * browser from the learner's local flashcard record, so nothing here reads a
 * session, a database or storage.
 */
export default function FlashcardReviewPage() {
  return (
    <div className="mx-auto w-full max-w-6xl pb-16">
      <header className="space-y-4">
        <div>
          <h1 className="text-h1 text-foreground">Flashcard review</h1>
          <p className="mt-2 max-w-3xl text-lead text-muted-foreground">
            Cards you rate in a lesson come back here when they are due, oldest first, followed by a few new cards from
            decks you have opened. Flip a card, then rate it: each button shows when the card would come back. Again
            starts the card over, and Hard, Good and Easy keep lengthening the gap.
          </p>
        </div>
        <LearnerSectionNav current="review" />
      </header>
      <div className="mt-8 max-w-3xl">
        <ReviewPageClient />
      </div>
    </div>
  );
}
