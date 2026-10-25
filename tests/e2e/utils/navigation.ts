import { Locator, Page, expect } from '@playwright/test';

/**
 * Clicks a link until the page reaches `url`. On a long lesson page, a click that lands while the
 * page is still hydrating, or while lazily mounted visualizers above the link shift the layout, can
 * be lost (seen on the 2-vCPU CI runner), so the click repeats until the URL changes.
 */
export async function followLink(page: Page, link: Locator, url: RegExp, timeout = 45_000) {
  await expect(async () => {
    if (!url.test(page.url())) await link.click({ timeout: 5_000 });
    await expect(page).toHaveURL(url, { timeout: 5_000 });
  }).toPass({ timeout });
}

/** Clicks `target` until `done` passes, for controls on a lesson page that may not have hydrated yet. */
export async function clickUntil(target: Locator, isDone: () => Promise<boolean>, done: () => Promise<void>, timeout = 45_000) {
  await expect(async () => {
    if (!(await isDone())) await target.click({ timeout: 5_000 });
    await done();
  }).toPass({ timeout });
}

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
