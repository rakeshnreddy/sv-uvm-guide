import { test, expect } from '@playwright/test';

test.describe('Curriculum Links Integrity', () => {
  test('all links on the main curriculum page should be navigable', async ({ page }) => {
    // Increase timeout for this test as it visits many pages
    test.setTimeout(240000); // 4 minutes

    await page.goto('/curriculum');

    // Wait for the main content to be visible
    await page.waitForSelector('div.grid');

    const links = await page.locator('a[href^="/curriculum/"]').evaluateAll((links: HTMLAnchorElement[]) =>
      links.map(link => link.href)
    );

    // Remove duplicates and the page's own link if present
    const uniqueLinks = [...new Set(links)];

    console.log(`Found ${uniqueLinks.length} unique curriculum links to check.`);

    for (const link of uniqueLinks) {
      console.log(`Checking link: ${link}`);
      const response = await page.goto(link, { waitUntil: 'domcontentloaded' });

      // Check if the response is successful
      expect(response?.status(), `URL ${link} should return status 200`).toBe(200);

      // Check for a main heading, indicating the page loaded content
      const heading = page.locator('h1');
      await expect(heading.first(), `URL ${link} should have an h1 title`).toBeVisible();

      // Optional: Check that the heading is not empty
      const headingText = await heading.first().textContent();
      expect(headingText?.trim(), `h1 at ${link} should not be empty`).not.toBe('');
    }
  });
});
