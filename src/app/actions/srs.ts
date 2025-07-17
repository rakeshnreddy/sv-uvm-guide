'use server';

import { PrismaClient } from '@prisma/client';
import { getIronSession } from 'iron-session';
import { sessionOptions } from '@/lib/session-options';
import { revalidatePath } from 'next/cache.js';
import { cookies } from 'next/headers.js';

const prisma = new PrismaClient();

import { getSession } from '@/lib/session';

export async function createFlashcard(topicId: string) {
  const session = await getSession();
  if (!session.userId) {
    throw new Error('You must be logged in to create a flashcard.');
  }

  // In a real application, you would fetch the content for the topicId
  // and use an AI to generate the front and back of the flashcard.
  // For now, we'll use placeholder content.
  const front = `What is the main concept of topic ${topicId}?`;
  const back = `This is a detailed explanation of the main concept of topic ${topicId}.`;

  const flashcard = await prisma.flashcard.create({
    data: {
      userId: session.userId,
      topicId,
      front,
      back,
    },
  });

  revalidatePath('/dashboard/memory-hub');
  return flashcard;
}

export async function reviewFlashcard(flashcardId: string, quality: number) {
  const session = await getSession();
  if (!session.userId) {
    throw new Error('You must be logged in to review a flashcard.');
  }

  const flashcard = await prisma.flashcard.findUnique({
    where: { id: flashcardId },
  });

  if (!flashcard || flashcard.userId !== session.userId) {
    throw new Error('Flashcard not found or you do not have permission to review it.');
  }

  // Simplified SM-2 algorithm implementation
  let { interval, repetitions, easinessFactor } = flashcard;

  if (quality >= 3) {
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easinessFactor);
    }
    repetitions += 1;
  } else {
    repetitions = 0;
    interval = 1;
  }

  easinessFactor = easinessFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (easinessFactor < 1.3) {
    easinessFactor = 1.3;
  }

  const nextReviewAt = new Date();
  nextReviewAt.setDate(nextReviewAt.getDate() + interval);

  const updatedFlashcard = await prisma.flashcard.update({
    where: { id: flashcardId },
    data: {
      interval,
      repetitions,
      easinessFactor,
      nextReviewAt,
    },
  });

  revalidatePath('/dashboard/memory-hub');
  return updatedFlashcard;
}

export async function getDueFlashcards() {
  const session = await getSession();
  if (!session.userId) {
    return [];
  }

  const dueFlashcards = await prisma.flashcard.findMany({
    where: {
      userId: session.userId,
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
