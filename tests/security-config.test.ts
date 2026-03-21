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
    vi.unstubAllEnvs();
  });

  describe('session-options', () => {
    it('throws an error in production if SESSION_SECRET is missing', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      delete process.env.SESSION_SECRET;

      await expect(loadSessionOptions()).rejects.toThrow(
        'SESSION_SECRET must be set in production to ensure secure sessions.'
      );
    });

    it('does not throw in development if SESSION_SECRET is missing', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      delete process.env.SESSION_SECRET;

      const mod = await loadSessionOptions();
      expect(mod.sessionOptions.password).toBe('test-secret-development-key-that-is-32-bytes-long');
    });
  });

  describe('auth-route', () => {
    it('throws an error in production if both secrets are missing', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      delete process.env.NEXTAUTH_SECRET;
      delete process.env.SESSION_SECRET;

      await expect(loadAuthRoute()).rejects.toThrow(
        'NEXTAUTH_SECRET or SESSION_SECRET must be set in production to ensure secure sessions.'
      );
    });

    it('does not throw in development if secrets are missing', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      delete process.env.NEXTAUTH_SECRET;
      delete process.env.SESSION_SECRET;

      const mod = await loadAuthRoute();
      // Since it's an ESM module and we're importing it, we just check it doesn't throw.
      // The actual value would be in the internal NextAuth call which we can't easily inspect without more mocking.
      expect(mod).toBeDefined();
    });
  });
});
