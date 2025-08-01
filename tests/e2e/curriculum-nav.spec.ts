import { test, expect } from '@playwright/test';
import { tiers } from '../../src/lib/curriculum-data';

test.describe('Curriculum Navigation', () => {
  test('all curriculum topic pages load successfully', async ({ page }) => {
    // Increase timeout as this test visits many pages
    test.setTimeout(240000); // 4 minutes

    for (const tier of tiers) {
      for (const module of tier.modules) {
        for (const topic of module.lessons) {
          const url = `/curriculum/${tier.slug}/${module.slug}/${topic.slug}`;
          console.log(`Navigating to: ${url}`);
          const response = await page.goto(url, { waitUntil: 'domcontentloaded' });

          // Check for successful response (200 OK)
          expect(response?.status(), `Failed to load ${url}`).toBe(200);

          // Check for a main heading to ensure content rendered
          const heading = page.locator('h1');
          await expect(heading.first(), `URL ${url} should have an h1 title`).toBeVisible();
          const headingText = await heading.first().textContent();
          expect(headingText?.trim(), `h1 at ${link} should not be empty`).not.toBe('');
        }
      }
    }
  });
});
