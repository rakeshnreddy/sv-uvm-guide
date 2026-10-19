/// <reference types="vitest/globals" />
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, vi, Mock, beforeEach } from 'vitest';
import { reviewFlashcard, getDueFlashcards } from '../src/app/actions/srs';
import * as srsActions from '../src/app/actions/srs';
import { prisma } from '@/lib/prisma';
import { withFrozenTime } from './setup/time-travel';

const mPrismaClient = vi.hoisted(() => ({

  flashcard: {
    findUnique: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
  },
}));

const auth = vi.hoisted(() => {
  class AuthenticationError extends Error {
    constructor(message = 'Authentication required') {
      super(message);
      this.name = 'AuthenticationError';
    }
  }
  return {
    AuthenticationError,
    requireSession: vi.fn(),
  };
});

const signedIn = { user: { id: 'test-user-id' } };

// Mock Prisma Client helper
vi.mock('@/lib/prisma', () => ({ prisma: mPrismaClient }));

vi.mock('@/lib/auth', () => ({
  requireSession: auth.requireSession,
  AuthenticationError: auth.AuthenticationError,
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

function storedFlashcard(overrides: Record<string, unknown> = {}) {
  return {
    id: 'test-flashcard-id',
    userId: 'test-user-id',
    topicId: 'test-topic-id',
    front: 'Test front',
    back: 'Test back',
    interval: 1,
    easinessFactor: 2.5,
    repetitions: 0,
    nextReviewAt: new Date(),
    ...overrides,
  };
}

describe('SRS Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.requireSession.mockResolvedValue(signedIn);
    (prisma.flashcard.update as Mock).mockImplementation(async ({ data }: { data: any }) => ({
      ...storedFlashcard(),
      ...data,
    }));
  });

  it('no longer exports a placeholder createFlashcard action', () => {
    expect('createFlashcard' in srsActions).toBe(false);
  });

  it('is not imported by any client component', () => {
    const files = (function walk(dir: string): string[] {
      return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        return entry.isDirectory() ? walk(full) : /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
      });
    })('src');
    const clientImporters = files.filter((file) => {
      const source = fs.readFileSync(file, 'utf8');
      return /^\s*['"]use client['"]/.test(source) && /['"]@\/app\/actions\/srs['"]/.test(source);
    });
    expect(clientImporters).toEqual([]);
  });

  it('should review a flashcard and update its state', async () => {
    await withFrozenTime('2024-01-15T09:00:00.000Z', async ({ now }) => {
      const flashcardId = 'test-flashcard-id';
      (prisma.flashcard.findUnique as Mock).mockResolvedValue(storedFlashcard());

      const quality = 4; // "Good"
      const updatedFlashcard = await reviewFlashcard(flashcardId, quality);

      expect(prisma.flashcard.findUnique).toHaveBeenCalledWith({ where: { id: flashcardId } });
      expect(prisma.flashcard.update).toHaveBeenCalled();
      expect(updatedFlashcard.repetitions).toBe(1);
      expect(updatedFlashcard.interval).toBe(1); // First repetition
      expect(updatedFlashcard.easinessFactor).toBe(2.5);
      const baseTime = now().getTime();
      expect(updatedFlashcard.nextReviewAt.getTime()).toBe(baseTime + 24 * 60 * 60 * 1000);
      expect(updatedFlashcard.lastReviewedAt?.getTime()).toBe(baseTime);
    });
  });

  it('resets a failed card with the shared scheduler', async () => {
    await withFrozenTime('2024-01-15T09:00:00.000Z', async ({ now }) => {
      (prisma.flashcard.findUnique as Mock).mockResolvedValue(
        storedFlashcard({ interval: 15, repetitions: 3, easinessFactor: 2.5 }),
      );

      const updated = await reviewFlashcard('test-flashcard-id', 0);

      expect(updated.repetitions).toBe(0);
      expect(updated.interval).toBe(1);
      expect(updated.easinessFactor).toBe(1.7);
      expect(updated.nextReviewAt.getTime()).toBe(now().getTime() + 24 * 60 * 60 * 1000);
    });
  });

  it('rejects a quality outside 0-5 before touching the database', async () => {
    await expect(reviewFlashcard('test-flashcard-id', 6)).rejects.toThrow(
      'Review quality must be an integer from 0 through 5.',
    );
    expect(prisma.flashcard.findUnique).not.toHaveBeenCalled();
  });

  it('refuses another learner\'s card', async () => {
    (prisma.flashcard.findUnique as Mock).mockResolvedValue(storedFlashcard({ userId: 'someone-else' }));
    await expect(reviewFlashcard('test-flashcard-id', 4)).rejects.toThrow(/not found/);
    expect(prisma.flashcard.update).not.toHaveBeenCalled();
  });

  it('fails closed for an anonymous caller', async () => {
    auth.requireSession.mockRejectedValue(new auth.AuthenticationError());

    await expect(reviewFlashcard('test-flashcard-id', 4)).rejects.toBeInstanceOf(auth.AuthenticationError);
    await expect(getDueFlashcards()).rejects.toBeInstanceOf(auth.AuthenticationError);
    expect(prisma.flashcard.findUnique).not.toHaveBeenCalled();
    expect(prisma.flashcard.findMany).not.toHaveBeenCalled();
    expect(prisma.flashcard.update).not.toHaveBeenCalled();
  });

  it('should get due flashcards for a user', async () => {
    const dueFlashcards = [
      { id: '1', nextReviewAt: new Date(Date.now() - 86400000) }, // 1 day ago
      { id: '2', nextReviewAt: new Date(Date.now() - 172800000) }, // 2 days ago
    ];

    (prisma.flashcard.findMany as Mock).mockResolvedValue(dueFlashcards);

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
