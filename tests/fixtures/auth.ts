import { expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

const DEFAULT_TEST_TOKEN = "local-browser-test-token-at-least-32-characters";
const DEFAULT_BASE_URL = "http://127.0.0.1:3100";

/**
 * True when Playwright runs in accounts mode (E2E_ACCOUNTS=true): test sign-in,
 * a disposable database and NEXT_PUBLIC_FEATURE_FLAG_ACCOUNT_UI=true. The
 * default run is anonymous, like the deployed site.
 */
export const ACCOUNTS_E2E = process.env.E2E_ACCOUNTS === "true";

/** The part of Playwright's `test` that requireAccountsMode needs, so extended `test` objects work too. */
interface SkippableTest {
  skip(condition: boolean, description?: string): void;
}

/**
 * Skips the calling file, describe block or test unless Playwright runs in
 * accounts mode. Account-only specs call it first, then sign in with
 * authenticateTestLearner.
 */
export function requireAccountsMode(test: SkippableTest): void {
  test.skip(
    !ACCOUNTS_E2E,
    "Account-mode spec: run with E2E_ACCOUNTS=true (AUTH_TEST_MODE, AUTH_TEST_TOKEN and a disposable DATABASE_URL)",
  );
}

export async function authenticateTestLearner(page: Page): Promise<void> {
  const csrfResponse = await page.request.get("/api/auth/csrf");
  expect(csrfResponse.ok()).toBe(true);
  const csrf: unknown = await csrfResponse.json();
  expect(csrf).toEqual(expect.objectContaining({ csrfToken: expect.any(String) }));

  const response = await page.request.post("/api/auth/callback/test-credentials?json=true", {
    form: {
      csrfToken: (csrf as { csrfToken: string }).csrfToken,
      token: process.env.AUTH_TEST_TOKEN ?? DEFAULT_TEST_TOKEN,
      identity: randomUUID(),
      callbackUrl: new URL("/", process.env.E2E_BASE_URL ?? DEFAULT_BASE_URL).toString(),
      json: "true",
    },
  });
  expect(
    response.ok(),
    "Test sign-in failed. Auth-gated specs need Playwright's own next dev server in accounts mode (E2E_ACCOUNTS=true, "
      + "AUTH_TEST_MODE=true, AUTH_TEST_TOKEN and a disposable DATABASE_URL); see 'Running the Playwright suites locally' "
      + "in CONTRIBUTING.md.",
  ).toBe(true);
  const result: unknown = await response.json();
  expect(result).toEqual(expect.objectContaining({ url: expect.any(String) }));
}
