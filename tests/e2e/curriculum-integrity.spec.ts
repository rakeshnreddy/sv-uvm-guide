import { test, expect } from '@playwright/test';

test.describe('Curriculum Links Integrity', () => {
  test('all visible links on the main curriculum page should be navigable', async ({ page }) => {
    // Increase timeout for this test as it visits many pages
    test.setTimeout(240000); // 4 minutes

    await page.goto('/curriculum');

    // Wait for the main content to be visible and for the skeleton to disappear
    await expect(page.locator('main > div > button').first()).toBeVisible();

    // Get all the accordion triggers that are not disabled
    const tierTriggers = await page.locator('main > div > button:not([disabled])').all();

    // Click each enabled trigger to open the accordion and reveal the links
    for (const trigger of tierTriggers) {
      await trigger.click();
      // Add a small wait for the animation to complete
      await page.waitForTimeout(500);
    }

    const links = await page.locator('a[href^="/curriculum/"]').evaluateAll((links: HTMLAnchorElement[]) =>
      links.map(link => link.href)
    );

    // Remove duplicates
    const uniqueLinks = [...new Set(links)];

    console.log(`Found ${uniqueLinks.length} unique curriculum links to check.`);
    expect(uniqueLinks.length).toBeGreaterThan(0); // Ensure we actually found links

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
