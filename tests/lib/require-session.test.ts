import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getServerSession, upsert } = vi.hoisted(() => ({ getServerSession: vi.fn(), upsert: vi.fn() }));
vi.mock('next-auth/next', () => ({ getServerSession }));
vi.mock('@/lib/prisma', () => ({ prisma: { user: { upsert } } }));

const uniqueViolation = () =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed on the fields: (`email`)', {
    code: 'P2002',
    clientVersion: 'test',
  });

describe('requireSession', () => {
  beforeEach(() => {
    vi.stubEnv('NEXTAUTH_SECRET', 'test-secret-at-least-32-characters-long');
    getServerSession.mockReset();
    upsert.mockReset();
    getServerSession.mockResolvedValue({ user: { id: 'u1', email: 'u1@example.test', name: 'U One' } });
  });

  it('creates or updates the user row and returns the principal', async () => {
    upsert.mockResolvedValue({});
    const { requireSession } = await import('@/lib/auth');
    await expect(requireSession()).resolves.toEqual({ user: { id: 'u1', email: 'u1@example.test', name: 'U One' } });
    expect(upsert).toHaveBeenCalledWith({
      where: { id: 'u1' },
      update: { email: 'u1@example.test', name: 'U One' },
      create: { id: 'u1', email: 'u1@example.test', name: 'U One' },
    });
  });

  it('retries once when a concurrent first request created the row (P2002)', async () => {
    upsert.mockRejectedValueOnce(uniqueViolation()).mockResolvedValueOnce({});
    const { requireSession } = await import('@/lib/auth');
    await expect(requireSession()).resolves.toMatchObject({ user: { id: 'u1' } });
    expect(upsert).toHaveBeenCalledTimes(2);
  });

  it('rethrows other database errors, and rejects a request without a session', async () => {
    const { requireSession, AuthenticationError } = await import('@/lib/auth');
    upsert.mockRejectedValueOnce(new Error('connection refused'));
    await expect(requireSession()).rejects.toThrow('connection refused');
    expect(upsert).toHaveBeenCalledTimes(1);

    getServerSession.mockResolvedValueOnce(null);
    await expect(requireSession()).rejects.toBeInstanceOf(AuthenticationError);
  });
});
