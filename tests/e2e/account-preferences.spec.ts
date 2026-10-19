import { expect, test, type Page, type Response } from '@playwright/test';

import { authenticateTestLearner, requireAccountsMode } from '../fixtures/auth';

/**
 * Account preferences and the navbar notification feed, for a signed-in
 * learner. Account-only: it needs accounts mode (E2E_ACCOUNTS=true: test
 * sign-in, a disposable database and NEXT_PUBLIC_FEATURE_FLAG_ACCOUNT_UI=true).
 * The anonymous default run skips it; /settings without an account is covered
 * by settings-data.spec.ts.
 */
requireAccountsMode(test);

/** The layout marks <html data-shortcuts-ready> once its keyboard shortcuts are live (after hydration). */
async function waitForShell(page: Page) {
  await page.locator('html[data-shortcuts-ready]').waitFor({ state: 'attached' });
}

function isPreferencesRequest(response: Response, method: 'GET' | 'PATCH'): boolean {
  return new URL(response.url()).pathname === '/api/me/preferences' && response.request().method() === method;
}

test.describe('account preferences', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateTestLearner(page);
  });

  test('settings shows the account panel and saves a toggle with one PATCH', async ({ page }) => {
    const patches: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname === '/api/me/preferences' && request.method() === 'PATCH') {
        patches.push(request.postData() ?? '');
      }
    });

    // The panel loads the saved preferences after hydration; listen before navigating.
    const loaded = page.waitForResponse((response) => isPreferencesRequest(response, 'GET'));
    await page.goto('/settings');
    expect((await loaded).ok()).toBe(true);
    await waitForShell(page);

    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Your learning data' })).toBeVisible();
    const panel = page.getByRole('region', { name: 'Account preferences' });
    await expect(panel).toBeVisible();

    const emailToggle = panel.getByRole('button', { name: /Email updates about new modules/i });
    await expect(emailToggle).toBeVisible();
    const wasOn = (await emailToggle.getAttribute('aria-pressed')) === 'true';

    const [patch] = await Promise.all([
      page.waitForResponse((response) => isPreferencesRequest(response, 'PATCH')),
      emailToggle.click(),
    ]);

    expect(patch.ok()).toBe(true);
    const sent = patch.request().postDataJSON() as { preferences: { notifications: { channels: { email: boolean } } } };
    expect(sent.preferences.notifications.channels.email).toBe(!wasOn);
    const payload = (await patch.json()) as { preferences: { notifications: { channels: { email: boolean } } } };
    expect(payload.preferences.notifications.channels.email).toBe(!wasOn);
    await expect(panel.getByText('Preferences saved')).toBeVisible();
    await expect(emailToggle).toHaveAttribute('aria-pressed', String(!wasOn));
    expect(patches).toHaveLength(1);

    // The saved value comes back on the next visit.
    const reloaded = page.waitForResponse((response) => isPreferencesRequest(response, 'GET'));
    await page.reload();
    await reloaded;
    await expect(
      page.getByRole('region', { name: 'Account preferences' }).getByRole('button', { name: /Email updates about new modules/i }),
    ).toHaveAttribute('aria-pressed', String(!wasOn));
  });

  test('navbar feed loads the notifications for a signed-in learner', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    // The feed requests /api/me/notifications when it mounts, not on click: listen before navigating.
    const feed = page.waitForResponse(
      (response) => new URL(response.url()).pathname === '/api/me/notifications' && response.request().method() === 'GET',
    );
    // The navbar's account controls live in the (learning) layout; the public landing page does not render them.
    await page.goto('/curriculum');
    const feedResponse = await feed;
    expect(feedResponse.ok()).toBe(true);
    const feedPayload = (await feedResponse.json()) as { notifications?: unknown };
    expect(Array.isArray(feedPayload.notifications)).toBe(true);
    await waitForShell(page);

    await page.getByTestId('notification-button').click();
    await expect(page.getByText('Notifications', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'View all' })).toHaveAttribute('href', '/notifications');
  });
});
