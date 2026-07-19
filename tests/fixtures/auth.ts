import { expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

const DEFAULT_TEST_TOKEN = "local-browser-test-token-at-least-32-characters";

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
      callbackUrl: "http://127.0.0.1:3100/",
      json: "true",
    },
  });
  expect(response.ok()).toBe(true);
  const result: unknown = await response.json();
  expect(result).toEqual(expect.objectContaining({ url: expect.any(String) }));
}
