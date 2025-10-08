import { expect, test } from '@playwright/test';

const flagsEnabled =
  process.env.FEATURE_FLAGS_FORCE_ON === 'true' ||
  process.env.NEXT_PUBLIC_FEATURE_FLAG_ACCOUNT_UI === 'true';

const describeOrSkip = flagsEnabled ? test.describe : test.describe.skip;

describeOrSkip('account preferences', () => {
  test('settings toggles update preferences', async ({ page }) => {
    await page.goto('/settings');

    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

    const emailToggle = page.getByRole('button', { name: /Email updates about new modules/i });
    const [patch] = await Promise.all([
      page.waitForResponse((response) =>
        response.url().includes('/api/preferences') && response.request().method() === 'PATCH',
      ),
      emailToggle.click(),
    ]);

    const payload = await patch.json();
    expect(payload.preferences.notifications.channels.email).toBe(false);

    await page.goto('/notifications');
    await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible();
    await expect(page.getByText(/Delivery schedule/)).toBeVisible();
  });

  test('navbar feed reflects preference categories', async ({ page }) => {
    await page.goto('/');
    const [fetchResponse] = await Promise.all([
      page.waitForResponse((response) =>
        response.url().includes('/api/notifications') && response.request().method() === 'GET',
      ),
      page.getByTestId('notification-button').click(),
    ]);

    const feedPayload = await fetchResponse.json();
    expect(Array.isArray(feedPayload.notifications)).toBe(true);

    await expect(page.getByText('Notifications', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/View all/)).toBeVisible();
  });
});
