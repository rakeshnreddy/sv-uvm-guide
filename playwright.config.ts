import { defineConfig } from '@playwright/test';

/**
 * Two e2e modes, chosen by E2E_ACCOUNTS:
 *
 * - anonymous (the default): the site as deployed. Port 3100, every
 *   NEXT_PUBLIC_FEATURE_FLAG_* is 'false' unless you exported it as 'true',
 *   test sign-in is off and there is no database. AUTH_TEST_MODE,
 *   AUTH_TEST_TOKEN and DATABASE_URL are overridden explicitly, because CI
 *   exports them for the whole job and Playwright's web server inherits the
 *   caller's environment.
 * - accounts (E2E_ACCOUNTS=true): port 3101, NEXT_PUBLIC_FEATURE_FLAG_ACCOUNT_UI
 *   'true', test sign-in on, and AUTH_TEST_TOKEN and DATABASE_URL passed through
 *   (use a disposable database). The AI tutor, simulation, community and draft
 *   flags still turn on only when exported, so no panel appears without its
 *   backend. Account-only specs call requireAccountsMode() from
 *   tests/fixtures/auth.ts and sign in with authenticateTestLearner().
 *
 * The two modes use different ports so a server left running in one mode is
 * never reused by the other. scripts/run-e2e-tests.cjs applies the same rules
 * to its build step; keep the two in step.
 */
export type E2eMode = 'anonymous' | 'accounts';

type SourceEnv = Readonly<Record<string, string | undefined>>;

export const E2E_PORTS: Readonly<Record<E2eMode, number>> = { anonymous: 3100, accounts: 3101 };

/** Every build-time feature flag variable read by src/tools/featureFlags.ts. */
export const FEATURE_FLAG_VARIABLES = [
  'NEXT_PUBLIC_FEATURE_FLAG_COMMUNITY',
  'NEXT_PUBLIC_FEATURE_FLAG_TRACKING',
  'NEXT_PUBLIC_FEATURE_FLAG_PERSONALIZATION',
  'NEXT_PUBLIC_FEATURE_FLAG_FAKE_COMMENTS',
  'NEXT_PUBLIC_FEATURE_FLAG_ACCOUNT_UI',
  'NEXT_PUBLIC_FEATURE_FLAG_AI_TUTOR',
  'NEXT_PUBLIC_FEATURE_FLAG_SIMULATION',
] as const;

/** Used only when the caller has no SESSION_SECRET; the server refuses to load auth without one. */
const DUMMY_SESSION_SECRET = 'test-session-secret-32-characters-long!!';
/** The token tests/fixtures/auth.ts sends when AUTH_TEST_TOKEN is not exported. */
const DEFAULT_TEST_TOKEN = 'local-browser-test-token-at-least-32-characters';

function nonEmpty(value: string | undefined): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function exportedAsTrue(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().toLowerCase() === 'true';
}

export function resolveE2eMode(source: SourceEnv = process.env): E2eMode {
  return source.E2E_ACCOUNTS === 'true' ? 'accounts' : 'anonymous';
}

export function e2eBaseUrl(mode: E2eMode): string {
  return `http://127.0.0.1:${E2E_PORTS[mode]}`;
}

/** The environment the e2e web server runs with. Every value is set explicitly, never inherited. */
export function buildE2eServerEnv(mode: E2eMode, source: SourceEnv = process.env): Record<string, string> {
  const flags: Record<string, string> = {};
  for (const name of FEATURE_FLAG_VARIABLES) {
    flags[name] = exportedAsTrue(source[name]) ? 'true' : 'false';
  }

  const shared = {
    ...flags,
    E2E_ACCOUNTS: mode === 'accounts' ? 'true' : 'false',
    NEXTAUTH_URL: e2eBaseUrl(mode),
    SESSION_SECRET: nonEmpty(source.SESSION_SECRET) ?? DUMMY_SESSION_SECRET,
  };

  if (mode === 'accounts') {
    return {
      ...shared,
      NEXT_PUBLIC_FEATURE_FLAG_ACCOUNT_UI: 'true',
      AUTH_TEST_MODE: 'true',
      AUTH_TEST_TOKEN: nonEmpty(source.AUTH_TEST_TOKEN) ?? DEFAULT_TEST_TOKEN,
      DATABASE_URL: typeof source.DATABASE_URL === 'string' ? source.DATABASE_URL : '',
    };
  }

  return {
    ...shared,
    AUTH_TEST_MODE: 'false',
    AUTH_TEST_TOKEN: '',
    DATABASE_URL: '',
  };
}

const mode = resolveE2eMode();
const baseURL = e2eBaseUrl(mode);
const serverEnv = buildE2eServerEnv(mode);

// Specs and fixtures run in this process and its workers: tell them where the
// server is, and in accounts mode which token it accepts.
process.env.E2E_BASE_URL = baseURL;
if (mode === 'accounts') {
  process.env.AUTH_TEST_TOKEN = serverEnv.AUTH_TEST_TOKEN;
}

export default defineConfig({
  testDir: './tests/e2e',
  webServer: {
    command: `node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port ${E2E_PORTS[mode]}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    env: serverEnv,
  },
  timeout: 120 * 1000,
  use: {
    baseURL,
    ...(process.env.PLAYWRIGHT_USE_SYSTEM_CHROME === 'true' ? { channel: 'chrome' as const } : {}),
  },
});
