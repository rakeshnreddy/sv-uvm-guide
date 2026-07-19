import { describe, it, expect, afterEach, vi } from 'vitest';

const loadAuthRoute = async () => {
  vi.resetModules();
  return await import('@/app/api/auth/[...nextauth]/route');
};

const loadAuthOptions = async () => {
  vi.resetModules();
  return (await import('@/lib/auth')).authOptions;
};

describe('Security Configuration', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllEnvs();
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

    it('enables the token-gated browser identity only outside production', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('SESSION_SECRET', 'test-session-secret-at-least-32-characters');
      vi.stubEnv('AUTH_TEST_MODE', 'true');
      vi.stubEnv('AUTH_TEST_TOKEN', 'test-browser-token-at-least-32-characters');
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;

      const options = await loadAuthOptions();
      const provider = options.providers[0] as unknown as {
        options: {
          id: string;
          authorize(credentials: Record<string, string>): Promise<{ id: string } | null>;
        };
      };
      expect(provider.options.id).toBe('test-credentials');
      await expect(provider.options.authorize({ token: 'wrong', identity: crypto.randomUUID() })).resolves.toBeNull();
      await expect(provider.options.authorize({
        token: 'test-browser-token-at-least-32-characters',
        identity: '4c85fe4f-e5e8-4390-9565-53ae0a09f5fa',
      })).resolves.toEqual(expect.objectContaining({
        id: 'e2e-learner-4c85fe4f-e5e8-4390-9565-53ae0a09f5fa',
      }));
    });

    it('never enables the browser test identity in production', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('SESSION_SECRET', 'test-session-secret-at-least-32-characters');
      vi.stubEnv('AUTH_TEST_MODE', 'true');
      vi.stubEnv('AUTH_TEST_TOKEN', 'test-browser-token-at-least-32-characters');
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;

      const options = await loadAuthOptions();
      expect((options.providers[0] as unknown as { options: { id: string } }).options.id).toBe('placeholder');
    });
  });
});
