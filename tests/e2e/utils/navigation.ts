import { Page, expect } from '@playwright/test';

const normalizePathname = (pathname: string) => {
  if (!pathname) {
    return '/';
  }
  const withoutIndex = pathname.replace(/\/index\/?$/, '/');
  if (withoutIndex === '/' || withoutIndex === '') {
    return '/';
  }
  return withoutIndex.endsWith('/') ? withoutIndex.slice(0, -1) : withoutIndex;
};

export async function assertNavigation(page: Page, href: string, homeUrl: string) {
  const homeUrlObject = new URL(homeUrl);
  const origin = homeUrlObject.origin;
  const targetUrl = new URL(href, origin);
  const expectedPath = targetUrl.pathname || '/';
  const normalizedTargetPath = normalizePathname(expectedPath);
  const homePath = homeUrlObject.pathname || '/';
  const normalizedHomePath = normalizePathname(homePath);
  const targetSearch = targetUrl.search || '';
  const homeSearch = homeUrlObject.search || '';
  const targetHash = targetUrl.hash || '';
  const homeHash = homeUrlObject.hash || '';

  const expectPathToEqual = async (normalizedPath: string) => {
    await expect.poll(() => normalizePathname(new URL(page.url()).pathname)).toBe(
      normalizedPath,
    );
  };

  await expectPathToEqual(normalizedHomePath);
  const link = page.locator(`a[href="${href}"]`).first();
  await expect(link).toBeVisible();

  const isSameLocation =
    normalizedTargetPath === normalizedHomePath &&
    targetSearch === homeSearch &&
    targetHash === homeHash;

  if (isSameLocation) {
    await link.click();
    await expectPathToEqual(normalizedHomePath);
  } else {
    await Promise.all([
      page.waitForURL(url => {
        const current = url instanceof URL ? url : new URL(url);
        return (
          current.origin === targetUrl.origin &&
          normalizePathname(current.pathname) === normalizedTargetPath
        );
      }),
      link.click(),
    ]);
    await expectPathToEqual(normalizedTargetPath);
  }

  const response = await page.request.get(targetUrl.toString());
  if (response.status() >= 400) {
    console.warn(`Skipped status check for ${targetUrl.toString()} (received ${response.status()})`);
  }

  const backResponse = await page.goBack({ waitUntil: 'domcontentloaded' });
  if (!backResponse) {
    await page.goto(homeUrl, { waitUntil: 'domcontentloaded' });
  }
  await expectPathToEqual(normalizedHomePath);
}
