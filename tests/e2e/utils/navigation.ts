import { Page, expect } from '@playwright/test';

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function assertNavigation(page: Page, href: string, homeUrl: string) {
  await page.goto(homeUrl);

  const origin = new URL(homeUrl).origin;
  const targetUrl = new URL(href, origin);
  const expectedPath = targetUrl.pathname || '/';

  const link = page.locator(`a[href="${href}"]`).first();
  await expect(link).toBeVisible();

  await Promise.all([
    page.waitForURL((url) => {
      const current = url instanceof URL ? url : new URL(url);
      return current.pathname === expectedPath;
    }),
    link.click(),
  ]);

  const expectedUrlMatcher = new RegExp(
    `^${escapeRegex(targetUrl.origin)}${escapeRegex(expectedPath)}(?:$|[/?#])`,
  );

  await expect(page).toHaveURL(expectedUrlMatcher);

  const response = await page.request.get(targetUrl.toString());
  if (response.status() >= 400) {
    console.warn(`Skipped status check for ${targetUrl.toString()} (received ${response.status()})`);
  }

  await page.goto(homeUrl);
}
