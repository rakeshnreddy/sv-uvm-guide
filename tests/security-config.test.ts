import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

const SECRET_MESSAGE = 'NEXTAUTH_SECRET or SESSION_SECRET must be set to ensure secure sessions.';

/**
 * '@/lib/prisma' is replaced in every auth test. @prisma/client loads the
 * project's .env into process.env the first time it is required, and .env may
 * hold SESSION_SECRET. That used to make the first "missing secret" case
 * flaky: in a fresh worker, importing auth pulled in Prisma, which restored
 * the secret the test had just deleted, so the import resolved instead of
 * rejecting (it passed only when Prisma was preloaded, e.g. with
 * NODE_OPTIONS='--require @prisma/client'). The secret check never needs a
 * database client.
 */
function mockPrisma() {
  vi.doMock('@/lib/prisma', () => ({ prisma: {}, getPrisma: () => ({}) }));
}

const loadAuthModule = async () => {
  vi.resetModules();
  mockPrisma();
  return await import('@/lib/auth');
};

const loadAuthOptions = async () => (await loadAuthModule()).authOptions;

const loadAuthRoute = async () => {
  vi.resetModules();
  mockPrisma();
  return await import('@/app/api/auth/[...nextauth]/route');
};

function removeSecrets() {
  vi.stubEnv('NEXTAUTH_SECRET', undefined);
  vi.stubEnv('SESSION_SECRET', undefined);
}

describe('Security Configuration', () => {
  afterEach(() => {
    vi.doUnmock('@/lib/prisma');
    vi.unstubAllEnvs();
  });

  describe('src/lib/auth.ts', () => {
    it('rejects the import if both secrets are missing in production', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      removeSecrets();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await expect(loadAuthModule()).rejects.toThrow(SECRET_MESSAGE);
      warn.mockRestore();
    });

    it('rejects the import if both secrets are missing in development', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      removeSecrets();

      await expect(loadAuthModule()).rejects.toThrow(SECRET_MESSAGE);
    });

    it('allows a missing secret only while next build collects page data, never at runtime', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      removeSecrets();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      vi.stubEnv('NEXT_PHASE', 'phase-production-build');
      await expect(loadAuthModule()).resolves.toBeDefined();

      // Any other phase (or none, as on the deployed Worker) still fails closed.
      vi.stubEnv('NEXT_PHASE', 'phase-production-server');
      await expect(loadAuthModule()).rejects.toThrow(SECRET_MESSAGE);
      vi.stubEnv('NEXT_PHASE', undefined);
      await expect(loadAuthModule()).rejects.toThrow(SECRET_MESSAGE);
      warn.mockRestore();
    });

    it('accepts either secret', async () => {
      removeSecrets();
      vi.stubEnv('NEXTAUTH_SECRET', 'nextauth-secret-at-least-32-characters');
      expect((await loadAuthOptions()).secret).toBe('nextauth-secret-at-least-32-characters');

      removeSecrets();
      vi.stubEnv('SESSION_SECRET', 'session-secret-at-least-32-characters');
      expect((await loadAuthOptions()).secret).toBe('session-secret-at-least-32-characters');
    });

    it('enables the token-gated browser identity only outside production', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('SESSION_SECRET', 'test-session-secret-at-least-32-characters');
      vi.stubEnv('AUTH_TEST_MODE', 'true');
      vi.stubEnv('AUTH_TEST_TOKEN', 'test-browser-token-at-least-32-characters');
      vi.stubEnv('GOOGLE_CLIENT_ID', undefined);
      vi.stubEnv('GOOGLE_CLIENT_SECRET', undefined);

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
      vi.stubEnv('GOOGLE_CLIENT_ID', undefined);
      vi.stubEnv('GOOGLE_CLIENT_SECRET', undefined);
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const options = await loadAuthOptions();
      expect(options.providers.map((provider) => (provider as unknown as { options: { id: string } }).options.id))
        .toEqual(['placeholder']);
      warn.mockRestore();
    });
  });

  describe('auth route', () => {
    it.each(['production', 'development'])(
      'imports without throwing in %s even with no secret, because it loads auth lazily',
      async (nodeEnv) => {
        vi.stubEnv('NODE_ENV', nodeEnv);
        removeSecrets();

        const route = await loadAuthRoute();
        expect(typeof route.GET).toBe('function');
        expect(typeof route.POST).toBe('function');
      },
    );

    it('answers 404 for sign-in and 200 {} for the session with the default flags, without a secret', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      removeSecrets();
      const { NextRequest } = await import('next/server');
      const { GET } = await loadAuthRoute();

      const signin = await GET(new NextRequest('https://example.test/api/auth/signin'), { params: { nextauth: ['signin'] } });
      const session = await GET(new NextRequest('https://example.test/api/auth/session'), { params: { nextauth: ['session'] } });

      expect(signin.status).toBe(404);
      await expect(signin.json()).resolves.toEqual({ error: 'ACCOUNTS_DISABLED' });
      expect(session.status).toBe(200);
      await expect(session.json()).resolves.toEqual({});
    });
  });

  describe('e2e server environment (playwright.config.ts)', () => {
    type PlaywrightConfigModule = typeof import('../playwright.config');

    // Mirrors the job-level env of .github/workflows/quality-gates.yml.
    const CI_ENV = Object.freeze({
      CI: 'true',
      DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:5432/migration_rehearsal',
      NEXTAUTH_URL: 'http://127.0.0.1:3100',
      SESSION_SECRET: 'ci-session-secret-at-least-32-characters',
      AUTH_TEST_MODE: 'true',
      AUTH_TEST_TOKEN: 'ci-browser-test-token-at-least-32-characters',
      FEATURE_FLAGS_FORCE_ON: 'true',
    });

    let config: PlaywrightConfigModule;
    let savedBaseUrl: string | undefined;
    let savedToken: string | undefined;

    beforeEach(async () => {
      savedBaseUrl = process.env.E2E_BASE_URL;
      savedToken = process.env.AUTH_TEST_TOKEN;
      vi.resetModules();
      config = await import('../playwright.config');
    });

    afterEach(() => {
      // Importing the config points E2E_BASE_URL at the chosen server.
      if (savedBaseUrl === undefined) delete process.env.E2E_BASE_URL;
      else process.env.E2E_BASE_URL = savedBaseUrl;
      if (savedToken === undefined) delete process.env.AUTH_TEST_TOKEN;
      else process.env.AUTH_TEST_TOKEN = savedToken;
    });

    it('chooses accounts mode only for E2E_ACCOUNTS=true', () => {
      expect(config.resolveE2eMode({})).toBe('anonymous');
      expect(config.resolveE2eMode({ E2E_ACCOUNTS: 'false' })).toBe('anonymous');
      expect(config.resolveE2eMode({ E2E_ACCOUNTS: '1' })).toBe('anonymous');
      expect(config.resolveE2eMode({ E2E_ACCOUNTS: 'true' })).toBe('accounts');
      expect(config.e2eBaseUrl('anonymous')).toBe('http://127.0.0.1:3100');
      expect(config.e2eBaseUrl('accounts')).toBe('http://127.0.0.1:3101');
    });

    it("overrides CI's test sign-in, token and database in the anonymous default", () => {
      const env = config.buildE2eServerEnv('anonymous', CI_ENV);

      expect(env).toMatchObject({
        AUTH_TEST_MODE: 'false',
        AUTH_TEST_TOKEN: '',
        DATABASE_URL: '',
        NEXTAUTH_URL: 'http://127.0.0.1:3100',
        SESSION_SECRET: CI_ENV.SESSION_SECRET,
      });
      for (const name of config.FEATURE_FLAG_VARIABLES) expect(env[name]).toBe('false');
      expect(env).not.toHaveProperty('FEATURE_FLAGS_FORCE_ON');
    });

    it('passes through only the flags the caller exported as true', () => {
      const env = config.buildE2eServerEnv('anonymous', {
        NEXT_PUBLIC_FEATURE_FLAG_PERSONALIZATION: 'true',
        NEXT_PUBLIC_FEATURE_FLAG_TRACKING: 'false',
        NEXT_PUBLIC_FEATURE_FLAG_COMMUNITY: 'maybe',
      });

      expect(env.NEXT_PUBLIC_FEATURE_FLAG_PERSONALIZATION).toBe('true');
      expect(env.NEXT_PUBLIC_FEATURE_FLAG_TRACKING).toBe('false');
      expect(env.NEXT_PUBLIC_FEATURE_FLAG_COMMUNITY).toBe('false');
      expect(env.NEXT_PUBLIC_FEATURE_FLAG_ACCOUNT_UI).toBe('false');
    });

    it('falls back to a dummy session secret of at least 32 characters', () => {
      const env = config.buildE2eServerEnv('anonymous', { SESSION_SECRET: '' });

      expect(env.SESSION_SECRET.length).toBeGreaterThanOrEqual(32);
    });

    it('turns on accounts and test sign-in in accounts mode, but never simulation or the AI tutor unless exported', () => {
      const env = config.buildE2eServerEnv('accounts', CI_ENV);

      expect(env).toMatchObject({
        NEXT_PUBLIC_FEATURE_FLAG_ACCOUNT_UI: 'true',
        AUTH_TEST_MODE: 'true',
        AUTH_TEST_TOKEN: CI_ENV.AUTH_TEST_TOKEN,
        DATABASE_URL: CI_ENV.DATABASE_URL,
        NEXTAUTH_URL: 'http://127.0.0.1:3101',
        NEXT_PUBLIC_FEATURE_FLAG_AI_TUTOR: 'false',
        NEXT_PUBLIC_FEATURE_FLAG_SIMULATION: 'false',
        NEXT_PUBLIC_FEATURE_FLAG_COMMUNITY: 'false',
        NEXT_PUBLIC_FEATURE_FLAG_PERSONALIZATION: 'false',
        NEXT_PUBLIC_FEATURE_FLAG_TRACKING: 'false',
      });

      const optedIn = config.buildE2eServerEnv('accounts', { ...CI_ENV, NEXT_PUBLIC_FEATURE_FLAG_SIMULATION: 'true' });
      expect(optedIn.NEXT_PUBLIC_FEATURE_FLAG_SIMULATION).toBe('true');
      expect(optedIn.NEXT_PUBLIC_FEATURE_FLAG_AI_TUTOR).toBe('false');
    });

    it('gives accounts mode the fixture token when none is exported', () => {
      const env = config.buildE2eServerEnv('accounts', { DATABASE_URL: 'postgresql://127.0.0.1:55432/sv_uvm_e2e' });

      expect(env.AUTH_TEST_TOKEN).toBe('local-browser-test-token-at-least-32-characters');
    });

    it('wires the computed env, port and base URL into the default export', () => {
      const mode = config.resolveE2eMode();
      const baseURL = config.e2eBaseUrl(mode);
      const webServer = config.default.webServer;

      expect(Array.isArray(webServer)).toBe(false);
      const server = webServer as { command: string; url?: string; env?: Record<string, string> };
      expect(server.env).toEqual(config.buildE2eServerEnv(mode));
      expect(server.url).toBe(baseURL);
      expect(server.command).toContain(`--port ${config.E2E_PORTS[mode]}`);
      expect(config.default.use?.baseURL).toBe(baseURL);
      expect(process.env.E2E_BASE_URL).toBe(baseURL);
    });
  });
});
