import { test } from '@playwright/test';
import { assertNavigation } from './utils/navigation';

// Ensure that each internal link on the home page is reachable
// and supports navigating back to the starting page.
test('home page internal links are navigable and support back navigation', async ({ page }) => {
  await page.goto('/');
  const homeUrl = page.url();

  const links = await page.$$eval('a[href^="/"]:not([href^="//"])', anchors => {
    const set = new Set<string>();
    anchors.forEach(a => {
      const href = a.getAttribute('href');
      const target = a.getAttribute('target');
      if (!href) {
        return;
      }
      if (href.startsWith('#')) {
        return;
      }
      if (target && target.toLowerCase() === '_blank') {
        return;
      }
      set.add(href);
    });
    return Array.from(set);
  });

  for (const href of links) {
    await test.step(`checking ${href}`, async () => {
      await assertNavigation(page, href, homeUrl);
    });
  }
});
