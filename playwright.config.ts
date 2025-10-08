import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  webServer: {
    command: 'npm run dev -- --hostname 127.0.0.1 --port 3100',
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: !process.env.CI,
    env: {
      NEXT_PUBLIC_FEATURE_FLAG_ACCOUNT_UI: 'true',
    },
  },
  timeout: 120 * 1000,
  use: {
    baseURL: 'http://127.0.0.1:3100',
  },
});
