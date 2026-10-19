import { test, expect } from '@playwright/test';

import { authenticateTestLearner, requireAccountsMode } from '../fixtures/auth';

const LESSON = '/curriculum/T1_Foundational/F1A_The_Cost_of_Bugs/index';
const BUTTON_LABEL = 'Open AI assistant';

test.describe('without a signed-in learner (the default)', () => {
  // AIAssistantWidget is a small gate; the button lives in a lazy chunk that loads only for a signed-in learner
  // with the AI tutor on. Runs in both e2e modes, never signed in.
  test('a lesson renders no assistant button and loads no script that carries it', async ({ page }) => {
    const scripts: Promise<{ url: string; text: string }>[] = [];
    const aiRequests: string[] = [];
    page.on('response', (response) => {
      if (response.request().resourceType() !== 'script') return;
      scripts.push(
        response
          .text()
          .then((text) => ({ url: response.url(), text }))
          .catch(() => ({ url: response.url(), text: '' })),
      );
    });
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/ai/')) aiRequests.push(request.url());
    });

    await page.goto(LESSON);
    // The layout marks <html data-shortcuts-ready> once its keyboard shortcuts are live (after hydration).
    await page.locator('html[data-shortcuts-ready]').waitFor({ state: 'attached' });
    await expect(page.getByRole('button', { name: BUTTON_LABEL })).toHaveCount(0);

    const loaded = await Promise.all(scripts);
    expect(loaded.length).toBeGreaterThan(0);
    expect(loaded.filter(({ text }) => text.includes(BUTTON_LABEL)).map(({ url }) => url)).toEqual([]);
    expect(aiRequests).toEqual([]);
  });
});

test.describe('with the AI tutor on and a learner signed in', () => {
  // The AI tutor is account-only: it needs accounts mode, a build with
  // NEXT_PUBLIC_FEATURE_FLAG_AI_TUTOR=true and a signed-in learner.
  requireAccountsMode(test);

  test.beforeEach(async ({ page }) => {
    const response = await page.request.get('/api/feature-flags');
    expect(response.ok()).toBe(true);
    const flags = (await response.json()) as Record<string, unknown>;
    test.skip(flags.aiTutor !== true, 'AI tutor spec: export NEXT_PUBLIC_FEATURE_FLAG_AI_TUTOR=true with E2E_ACCOUNTS=true');
    await authenticateTestLearner(page);
  });

  test('AI assistant shows loading spinner when sending message', async ({ page }) => {
    await page.route('**/api/ai/chat', async route => {
      await new Promise(r => setTimeout(r, 500));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ reply: 'hi there' })
      });
    });
    // The assistant is mounted by the (learning) layout; the public landing page at / does not render it.
    // Its button loads as a lazy chunk after hydration and the session check; click() waits for it.
    await page.goto('/curriculum');
    await page.getByRole('button', { name: BUTTON_LABEL }).click();
    const dialog = page.getByRole('dialog', { name: 'AI Assistant' });
    await dialog.getByRole('textbox', { name: 'Message to AI tutor' }).fill('hello');
    await dialog.getByRole('button', { name: 'Send message' }).click();
    const thinking = dialog.getByText('Assistant is thinking…');
    await expect(thinking).toBeVisible();
    await expect(thinking).toBeHidden();
    await expect(dialog.getByText('hi there')).toBeVisible();
  });
});
