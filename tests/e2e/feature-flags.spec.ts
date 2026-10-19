import { expect, test, type APIRequestContext } from '@playwright/test';

/*
 * The default site, as deployed: every NEXT_PUBLIC_FEATURE_FLAG_* is off
 * (Playwright's default mode is anonymous). Pages that are not ready, or
 * that need accounts, answer 404 and are not linked from the navigation.
 *
 * Flags are inlined at build time, so ask the running server which ones are
 * on rather than reading this process's environment. A test skips only when
 * the server reports the draft or accounts flag that turns its page on.
 */

type ServerFlags = Partial<Record<'community' | 'tracking' | 'personalization' | 'accountUI', boolean>>;

let serverFlags: ServerFlags = {};

async function loadServerFlags(request: APIRequestContext): Promise<ServerFlags> {
  const response = await request.get('/api/feature-flags');
  return response.ok() ? ((await response.json()) as ServerFlags) : {};
}

/** The hidden pages, and the flags that would turn each one on. */
const HIDDEN_PAGES: Array<{ path: string; shownWhen: (flags: ServerFlags) => boolean; reason: string }> = [
  {
    path: '/community',
    shownWhen: (flags) => Boolean(flags.community && flags.accountUI),
    reason: 'community and accountUI are on for this server',
  },
  { path: '/notifications', shownWhen: (flags) => Boolean(flags.accountUI), reason: 'accountUI is on for this server' },
  { path: '/assessment', shownWhen: (flags) => Boolean(flags.tracking), reason: 'tracking (draft preview) is on for this server' },
  {
    path: '/projects',
    shownWhen: (flags) => Boolean(flags.personalization),
    reason: 'personalization (draft preview) is on for this server',
  },
  {
    path: '/history',
    shownWhen: (flags) => Boolean(flags.personalization),
    reason: 'personalization (draft preview) is on for this server',
  },
  {
    path: '/resources',
    shownWhen: (flags) => Boolean(flags.personalization),
    reason: 'personalization (draft preview) is on for this server',
  },
];

test.describe('hidden pages on the default site', () => {
  test.beforeAll(async ({ request }) => {
    serverFlags = await loadServerFlags(request);
  });

  for (const { path, shownWhen, reason } of HIDDEN_PAGES) {
    test(`${path} returns 404`, async ({ page }) => {
      test.skip(shownWhen(serverFlags), reason);
      const response = await page.goto(path);

      expect(response?.status()).toBe(404);
      await expect(page.getByText('This page could not be found.')).toBeVisible();
      // No placeholder copy leaks through.
      await expect(page.getByText(/will launch|will re-open|currently disabled|is paused|listed here soon/i)).toHaveCount(0);
    });
  }

  test('the navigation links no hidden page', async ({ page }) => {
    test.skip(
      Boolean(serverFlags.accountUI || serverFlags.personalization || serverFlags.tracking),
      'A draft or accounts flag is on for this server; this checks the default build.',
    );
    await page.goto('/curriculum');
    await page.locator('html[data-shortcuts-ready]').waitFor({ state: 'attached' });

    const hrefs = await page
      .locator('header a[href], nav a[href]')
      .evaluateAll((links) => links.map((link) => new URL((link as HTMLAnchorElement).href).pathname));
    for (const { path } of HIDDEN_PAGES) expect(hrefs, `a navigation link points at ${path}`).not.toContain(path);
    expect(hrefs).toContain('/dashboard');
  });
});
