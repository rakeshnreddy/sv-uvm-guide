import { test, expect } from '@playwright/test';

// The hero tagline on the home page rotates through multiple messages.
// Verify that the text changes over time, demonstrating the animation.
test('hero tagline cycles through messages', async ({ page }) => {
  await page.goto('/');
  const tagline = page.locator('section').locator('p').first();
  const initialText = await tagline.textContent();
  await page.waitForTimeout(6000); // wait for animation interval (5s)
  await expect(tagline).not.toHaveText(initialText || '');
});
