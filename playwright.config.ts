import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  webServer: {
    command: 'npm run dev -- --hostname 127.0.0.1',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    env: {
      FEATURE_FLAGS_FORCE_ON: 'true',
      NEXT_PUBLIC_FEATURE_FLAG_COMMUNITY: 'true',
      NEXT_PUBLIC_FEATURE_FLAG_TRACKING: 'true',
      NEXT_PUBLIC_FEATURE_FLAG_PERSONALIZATION: 'true',
      NEXT_PUBLIC_FEATURE_FLAG_FAKE_COMMENTS: 'true',
      NEXT_PUBLIC_FEATURE_FLAG_ACCOUNT_UI: 'true',
    },
  },
  timeout: 120 * 1000,
  use: {
    baseURL: 'http://127.0.0.1:3000',
  },
});
