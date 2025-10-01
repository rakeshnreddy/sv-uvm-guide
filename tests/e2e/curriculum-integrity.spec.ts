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

    for (const link of Array.from(uniqueLinks)) {
      console.log(`Checking link: ${link}`);

      const parsed = new URL(link);
      const hash = parsed.hash ? parsed.hash.slice(1) : '';
      const targetPath = `${parsed.pathname}${parsed.search}`;

      const response = await page.goto(targetPath, { waitUntil: 'domcontentloaded' });

      if (response) {
        expect(response.status(), `URL ${targetPath} should return < 400`).toBeLessThan(400);
      } else {
        const current = new URL(page.url());
        expect(
          `${current.pathname}${current.search}`,
          `Navigation for ${targetPath} should resolve even when Playwright returns no response (likely hash navigation).`
        ).toBe(targetPath);
      }

      // Check for a main heading, indicating the page loaded content
      const heading = page.getByRole('heading', { level: 1 }).first();
      await expect(heading, `URL ${targetPath} should have an h1 title`).toBeVisible();

      const headingText = (await heading.textContent())?.trim();
      expect(headingText, `h1 at ${targetPath} should not be empty`).toBeTruthy();

      if (hash) {
        await page.goto(link, { waitUntil: 'domcontentloaded' });
        const currentHash = await page.evaluate(() => window.location.hash);
        expect(currentHash, `Hash navigation should set window.location.hash for ${link}`).toBe(`#${hash}`);
      }
    }
  });
});
