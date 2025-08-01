import { test, expect } from '@playwright/test';
import { tiers } from '../../src/lib/curriculum-data';

test.describe('Curriculum Page Title Integrity', () => {
  // Increase timeout as this test visits many pages
  test.setTimeout(240000); // 4 minutes

  for (const tier of tiers) {
    for (const module of tier.modules) {
      for (const topic of module.lessons) {
        const url = `/curriculum/${tier.slug}/${module.slug}/${topic.slug}`;

        test(`page ${url} should have the correct title`, async ({ page }) => {
          await page.goto(url, { waitUntil: 'domcontentloaded' });

          const response = await page.waitForResponse(response => response.url().endsWith(url) && response.status() === 200);
          expect(response.status()).toBe(200);

          const heading = page.locator('h1');
          await expect(heading).toBeVisible();

          // Use a flexible check for the title, as it might be decorated
          await expect(heading).toContainText(topic.title);
        });
      }
    }
  }
});
