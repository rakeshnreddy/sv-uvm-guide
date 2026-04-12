import { describe, it, expect, afterEach, vi } from 'vitest';

const loadSessionOptions = async () => {
  vi.resetModules();
  return await import('@/lib/session-options');
};

const loadAuthRoute = async () => {
  vi.resetModules();
  return await import('@/app/api/auth/[...nextauth]/route');
};

describe('Security Configuration', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllEnvs();
  });

  describe('session-options', () => {
    it('throws an error if SESSION_SECRET is missing in production', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      delete process.env.SESSION_SECRET;

      await expect(loadSessionOptions()).rejects.toThrow(
        'SESSION_SECRET must be set to ensure secure sessions.'
      );
    });

    it('throws an error if SESSION_SECRET is missing in development', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      delete process.env.SESSION_SECRET;

      await expect(loadSessionOptions()).rejects.toThrow(
        'SESSION_SECRET must be set to ensure secure sessions.'
      );
    });
  });

  describe('auth-route', () => {
    it('throws an error if both secrets are missing in production', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      delete process.env.NEXTAUTH_SECRET;
      delete process.env.SESSION_SECRET;

      await expect(loadAuthRoute()).rejects.toThrow(
        'NEXTAUTH_SECRET or SESSION_SECRET must be set to ensure secure sessions.'
      );
    });

    it('throws an error if both secrets are missing in development', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      delete process.env.NEXTAUTH_SECRET;
      delete process.env.SESSION_SECRET;

      await expect(loadAuthRoute()).rejects.toThrow(
        'NEXTAUTH_SECRET or SESSION_SECRET must be set to ensure secure sessions.'
      );
    });
  });
});
