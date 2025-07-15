import { describe, it, expect, vi } from 'vitest';
import { createFlashcard, reviewFlashcard, getDueFlashcards } from '../src/app/actions/srs';
import { PrismaClient } from '@prisma/client';

// Mock Prisma Client
vi.mock('@prisma/client', () => {
  const mPrismaClient = {
    flashcard: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
  };
  return { PrismaClient: vi.fn(() => mPrismaClient) };
});

// Mock iron-session
vi.mock('iron-session', () => ({
  getIronSession: vi.fn().mockResolvedValue({ userId: 'test-user-id' }),
}));

describe('SRS Actions', () => {
  const prisma = new PrismaClient();

  it('should create a flashcard', async () => {
    const topicId = 'test-topic-id';
    const expectedFlashcard = {
      id: 'new-flashcard-id',
      userId: 'test-user-id',
      topicId,
      front: `What is the main concept of topic ${topicId}?`,
      back: `This is a detailed explanation of the main concept of topic ${topicId}.`,
      interval: 1,
      easinessFactor: 2.5,
      repetitions: 0,
      nextReviewAt: new Date(),
    };

    (prisma.flashcard.create as vi.Mock).mockResolvedValue(expectedFlashcard);

    const flashcard = await createFlashcard(topicId);

    expect(prisma.flashcard.create).toHaveBeenCalledWith({
      data: {
        userId: 'test-user-id',
        topicId,
        front: expectedFlashcard.front,
        back: expectedFlashcard.back,
      },
    });
    expect(flashcard).toEqual(expectedFlashcard);
  });

  it('should review a flashcard and update its state', async () => {
    const flashcardId = 'test-flashcard-id';
    const initialFlashcard = {
      id: flashcardId,
      userId: 'test-user-id',
      topicId: 'test-topic-id',
      front: 'Test front',
      back: 'Test back',
      interval: 1,
      easinessFactor: 2.5,
      repetitions: 0,
      nextReviewAt: new Date(),
    };

    (prisma.flashcard.findUnique as vi.Mock).mockResolvedValue(initialFlashcard);
    (prisma.flashcard.update as vi.Mock).mockImplementation(async ({ data }) => ({
      ...initialFlashcard,
      ...data,
    }));

    const quality = 4; // "Good"
    const updatedFlashcard = await reviewFlashcard(flashcardId, quality);

    expect(prisma.flashcard.findUnique).toHaveBeenCalledWith({ where: { id: flashcardId } });
    expect(prisma.flashcard.update).toHaveBeenCalled();
    expect(updatedFlashcard.repetitions).toBe(1);
    expect(updatedFlashcard.interval).toBe(1); // First repetition
    expect(updatedFlashcard.nextReviewAt.getDate()).toBe(new Date().getDate() + 1);
  });

  it('should get due flashcards for a user', async () => {
    const dueFlashcards = [
      { id: '1', nextReviewAt: new Date(Date.now() - 86400000) }, // 1 day ago
      { id: '2', nextReviewAt: new Date(Date.now() - 172800000) }, // 2 days ago
    ];

    (prisma.flashcard.findMany as vi.Mock).mockResolvedValue(dueFlashcards);

    const result = await getDueFlashcards();

    expect(prisma.flashcard.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'test-user-id',
        nextReviewAt: {
          lte: expect.any(Date),
        },
      },
      orderBy: {
        nextReviewAt: 'asc',
      },
    });
    expect(result).toEqual(dueFlashcards);
  });
});
