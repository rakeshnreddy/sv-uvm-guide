'use server';

/**
 * Account-era flashcard review actions. They stay behind requireSession and
 * fail closed (AuthenticationError) without a signed-in learner; no page calls
 * them while accounts are off, and no client component imports this module.
 * Learners review in the browser through src/lib/srs/review-store.ts, which
 * uses the same scheduler.
 */
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { assertReviewQuality, scheduleReview } from '@/lib/srs/scheduler';

export async function reviewFlashcard(flashcardId: string, quality: number) {
  const session = await requireSession();
  assertReviewQuality(quality);

  const flashcard = await prisma.flashcard.findUnique({
    where: { id: flashcardId },
  });

  if (!flashcard || flashcard.userId !== session.user.id) {
    throw new Error('Flashcard not found or you do not have permission to review it.');
  }

  const now = Date.now();
  const next = scheduleReview(
    {
      interval: flashcard.interval,
      repetitions: flashcard.repetitions,
      ease: flashcard.easinessFactor,
    },
    quality,
    now,
  );

  const updatedFlashcard = await prisma.flashcard.update({
    where: { id: flashcardId },
    data: {
      interval: next.interval,
      repetitions: next.repetitions,
      easinessFactor: next.ease,
      nextReviewAt: new Date(next.dueAt),
      lastReviewedAt: new Date(now),
    },
  });

  return updatedFlashcard;
}

export async function getDueFlashcards() {
  const session = await requireSession();

  const dueFlashcards = await prisma.flashcard.findMany({
    where: {
      userId: session.user.id,
      nextReviewAt: {
        lte: new Date(),
      },
    },
    orderBy: {
      nextReviewAt: 'asc',
    },
  });

  return dueFlashcards;
}
