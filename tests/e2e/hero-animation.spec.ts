import { test, expect } from '@playwright/test';

// The hero shows one fixed subtitle (landing-17): it does not rotate, so it reads the same
// with or without reduced motion, and it states counts taken from the curriculum data.
test('hero subtitle is fixed and states the lesson, tier and lab counts', async ({ page }) => {
  await page.goto('/');
  const subtitle = page.locator('main section').first().locator('h1 + p');
  await expect(subtitle).toHaveText(
    /^\d+ lessons in \d+ tiers, from your first testbench to staff-level interviews, with interactive models, \d+ guided labs and interview prep$/,
  );
  const initialText = await subtitle.textContent();
  await page.waitForTimeout(6000);
  await expect(subtitle).toHaveText(initialText ?? '');
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('every home section is visible in the server HTML (landing-1)', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: /Master SystemVerilog & UVM/ })).toBeVisible();
    await expect(page.getByRole('article', { name: 'Start here', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Browse the labs', exact: true })).toBeVisible();
  });
});
