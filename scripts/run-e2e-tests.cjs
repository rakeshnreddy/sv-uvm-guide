#!/usr/bin/env node

/**
 * Builds the app, then runs Playwright, in one of the two e2e modes defined in
 * playwright.config.ts (keep the rules here in step with it):
 *
 * - anonymous (the default): every NEXT_PUBLIC_FEATURE_FLAG_* is 'false' unless
 *   exported as 'true', AUTH_TEST_MODE 'false', AUTH_TEST_TOKEN and
 *   DATABASE_URL empty. These override anything the caller or CI exported.
 * - accounts (E2E_ACCOUNTS=true): NEXT_PUBLIC_FEATURE_FLAG_ACCOUNT_UI 'true',
 *   AUTH_TEST_MODE 'true', AUTH_TEST_TOKEN and DATABASE_URL passed through
 *   (point DATABASE_URL at a disposable database). Other flags stay opt-in.
 *
 * Extra arguments go to `playwright test`, e.g.
 *   node scripts/run-e2e-tests.cjs tests/e2e/labs.spec.ts
 */

const { spawnSync } = require('node:child_process');

const FEATURE_FLAG_VARIABLES = [
  'NEXT_PUBLIC_FEATURE_FLAG_COMMUNITY',
  'NEXT_PUBLIC_FEATURE_FLAG_TRACKING',
  'NEXT_PUBLIC_FEATURE_FLAG_PERSONALIZATION',
  'NEXT_PUBLIC_FEATURE_FLAG_FAKE_COMMENTS',
  'NEXT_PUBLIC_FEATURE_FLAG_ACCOUNT_UI',
  'NEXT_PUBLIC_FEATURE_FLAG_AI_TUTOR',
  'NEXT_PUBLIC_FEATURE_FLAG_SIMULATION',
];

const DUMMY_SESSION_SECRET = 'test-session-secret-32-characters-long!!';
const DEFAULT_TEST_TOKEN = 'local-browser-test-token-at-least-32-characters';

const accountsMode = process.env.E2E_ACCOUNTS === 'true';

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function exportedAsTrue(value) {
  return typeof value === 'string' && value.trim().toLowerCase() === 'true';
}

const featureFlagEnv = Object.fromEntries(
  FEATURE_FLAG_VARIABLES.map((name) => [name, exportedAsTrue(process.env[name]) ? 'true' : 'false']),
);

const modeEnv = accountsMode
  ? {
      ...featureFlagEnv,
      NEXT_PUBLIC_FEATURE_FLAG_ACCOUNT_UI: 'true',
      E2E_ACCOUNTS: 'true',
      AUTH_TEST_MODE: 'true',
      AUTH_TEST_TOKEN: nonEmpty(process.env.AUTH_TEST_TOKEN) ?? DEFAULT_TEST_TOKEN,
      DATABASE_URL: typeof process.env.DATABASE_URL === 'string' ? process.env.DATABASE_URL : '',
    }
  : {
      ...featureFlagEnv,
      E2E_ACCOUNTS: 'false',
      AUTH_TEST_MODE: 'false',
      AUTH_TEST_TOKEN: '',
      DATABASE_URL: '',
    };

const env = {
  ...process.env,
  ...modeEnv,
  // src/lib/auth.ts refuses to load without a secret, and next build imports
  // the API routes that use it, so the build needs one too.
  SESSION_SECRET: nonEmpty(process.env.SESSION_SECRET) ?? DUMMY_SESSION_SECRET,
};

console.log(`Running the e2e suite in ${accountsMode ? 'accounts' : 'anonymous'} mode.`);

let result = spawnSync('npx', ['next', 'build'], {
  stdio: 'inherit',
  env,
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

result = spawnSync('npx', ['playwright', 'test', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env,
});

process.exit(result.status ?? 1);
