import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  webServer: {
    command: 'node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3100',
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: !process.env.CI,
    env: {
      AUTH_TEST_MODE: process.env.AUTH_TEST_MODE ?? 'false',
      AUTH_TEST_TOKEN: process.env.AUTH_TEST_TOKEN ?? '',
      DATABASE_URL: process.env.DATABASE_URL ?? '',
      NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? 'http://127.0.0.1:3100',
      SESSION_SECRET: process.env.SESSION_SECRET ?? '',
      NEXT_PUBLIC_FEATURE_FLAG_COMMUNITY: 'true',
      NEXT_PUBLIC_FEATURE_FLAG_TRACKING: 'true',
      NEXT_PUBLIC_FEATURE_FLAG_PERSONALIZATION: 'true',
      NEXT_PUBLIC_FEATURE_FLAG_FAKE_COMMENTS: 'true',
      NEXT_PUBLIC_FEATURE_FLAG_ACCOUNT_UI: 'true',
      FEATURE_FLAGS_FORCE_ON: 'true',
    },
  },
  timeout: 120 * 1000,
  use: {
    baseURL: 'http://127.0.0.1:3100',
    ...(process.env.PLAYWRIGHT_USE_SYSTEM_CHROME === 'true' ? { channel: 'chrome' as const } : {}),
  },
});
