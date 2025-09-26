import { expect, test } from '@playwright/test';

const flagsEnabled =
  process.env.FEATURE_FLAGS_FORCE_ON === 'true' ||
  process.env.NEXT_PUBLIC_FEATURE_FLAG_COMMUNITY === 'true' ||
  process.env.NEXT_PUBLIC_FEATURE_FLAG_TRACKING === 'true' ||
  process.env.NEXT_PUBLIC_FEATURE_FLAG_PERSONALIZATION === 'true' ||
  process.env.NEXT_PUBLIC_FEATURE_FLAG_ACCOUNT_UI === 'true';

const describeOrSkip = flagsEnabled ? test.describe.skip : test.describe;

describeOrSkip('feature flag defaults', () => {
  test('dashboard route returns 404 when tracking flag is off', async ({ page }) => {
    const response = await page.goto('/dashboard');

    expect(response?.status()).toBe(404);
    await expect(page.getByText('This page could not be found.')).toBeVisible();
  });

  test('community route returns 404 when community flag is off', async ({ page }) => {
    const response = await page.goto('/community');

    expect(response?.status()).toBe(404);
    await expect(page.getByText('This page could not be found.')).toBeVisible();
  });

  test('notifications route falls back to placeholder copy', async ({ page }) => {
    await page.goto('/notifications');

    await expect(
      page.getByText('Notifications will launch once account preferences are wired up.'),
    ).toBeVisible();
  });

  test('projects route surfaces placeholder guidance by default', async ({ page }) => {
    await page.goto('/projects');

    await expect(
      page.getByText('Project workspaces will re-open once personalization features are prioritized.'),
    ).toBeVisible();
  });
});
