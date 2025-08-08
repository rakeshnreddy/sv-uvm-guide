import { test, expect } from '@playwright/test';

// Ensure that each internal link on the home page is reachable
// and supports navigating back to the starting page.
test('home page internal links are navigable and support back navigation', async ({ page }) => {
  await page.goto('/');
  const homeUrl = page.url();

  const links = await page.$$eval('a[href^="/"]:not([href^="//"])', anchors => {
    const set = new Set<string>();
    anchors.forEach(a => {
      const href = a.getAttribute('href');
      if (href && !href.startsWith('#')) {
        set.add(href);
      }
    });
    return Array.from(set);
  });

  for (const href of links) {
    await test.step(`checking ${href}`, async () => {
      const response = await page.goto(href);
      expect(response?.status()).toBeLessThan(400);
      await page.goBack();
      await expect(page).toHaveURL(homeUrl);
    });
  }
});
