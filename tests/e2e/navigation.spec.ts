import { test, expect, type Page } from '@playwright/test';

import { authenticateTestLearner, requireAccountsMode } from '../fixtures/auth';
import { followLink } from './utils/navigation';

test('sequence arbitration page next link navigates to sequence libraries', async ({ page }) => {
  await page.goto('/curriculum/T2_Intermediate/I-UVM-3B_Advanced_Sequencing_and_Layering/sequence-arbitration');
  const nextLessonLink = page.getByRole('link', { name: /^Next lesson Sequence Libraries & Arbitration Control/i });
  await expect(nextLessonLink, 'Next lesson link should be rendered once').toHaveCount(1);
  await followLink(page, nextLessonLink, /\/curriculum\/T2_Intermediate\/I-UVM-3B_Advanced_Sequencing_and_Layering\/sequence-libraries$/);
  await expect(page.getByRole('heading', { level: 1 }).first()).toContainText('Sequence Libraries & Arbitration Control');
});

const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
const MAILBOXES = '/curriculum/T2_Intermediate/I-SV-5_Synchronization_and_IPC/mailboxes';

/** The layout marks <html data-shortcuts-ready> once its keyboard shortcuts are live (after hydration). */
async function waitForShell(page: Page) {
  await page.locator('html[data-shortcuts-ready]').waitFor({ state: 'attached' });
}

async function accountUiEnabled(page: Page): Promise<boolean> {
  // NEXT_PUBLIC_* flags are inlined at build time, so ask the running server
  // rather than this process's environment.
  const flags = await (await page.request.get('/api/feature-flags')).json();
  return Boolean(flags.accountUI);
}

/** Paths a learning page must never request while accounts are off. */
const ACCOUNT_REQUEST = /\/api\/(auth|me)\//;

test.describe('Advanced Navigation Features', () => {

  // The navbar, course outline and keyboard shortcuts belong to the (learning)
  // layout; the public landing page at / does not render them.
  test.beforeEach(async ({ page }) => {
    await page.goto('/curriculum');
    await waitForShell(page);
  });

  test('should toggle the course outline drawer with the navbar button', async ({ page }) => {
    const outlineHeading = page.getByRole('heading', { name: 'Course outline' });
    const toggle = page.getByRole('button', { name: 'Course outline', exact: true });
    await expect(outlineHeading).toHaveCount(0);
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await toggle.click();
    const drawer = page.getByRole('dialog', { name: 'Course outline' });
    await expect(drawer).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(drawer.getByRole('navigation', { name: 'Course outline' })).toBeVisible();

    await page.getByRole('button', { name: 'Close course outline' }).click();
    await expect(outlineHeading).toHaveCount(0);
    await expect(toggle).toBeFocused();
  });

  test('should toggle the course outline with the keyboard shortcut (Ctrl/Cmd+B) and close it with Escape', async ({ page }) => {
    const outlineHeading = page.getByRole('heading', { name: 'Course outline' });
    await expect(outlineHeading).toHaveCount(0);
    await page.keyboard.press(`${modifier}+KeyB`);
    await expect(outlineHeading).toBeVisible();
    await page.keyboard.press(`${modifier}+KeyB`);
    await expect(outlineHeading).toHaveCount(0);

    await page.keyboard.press(`${modifier}+KeyB`);
    await expect(outlineHeading).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(outlineHeading).toHaveCount(0);
  });

  test('should focus search bar with keyboard shortcut (Ctrl+K)', async ({ page }) => {
    await page.keyboard.press(`${modifier}+KeyK`);
    const searchInput = page.getByTestId('main-search-input');
    await expect.poll(async () => {
      return searchInput.evaluate((el) => document.activeElement === el);
    }).toBeTruthy();
  });

  test('should search from the navbar and open the chosen lesson with Enter (G30-SRCH-01)', async ({ page }) => {
    await page.keyboard.press(`${modifier}+KeyK`);
    const searchInput = page.getByTestId('main-search-input');
    await expect(searchInput).toBeFocused();
    await searchInput.fill('mailbox');

    const results = page.getByRole('listbox', { name: 'Search results' });
    await expect(results.getByRole('option').first()).toBeVisible();
    await expect(results.getByRole('option', { name: /Mailboxes/ }).first()).toHaveAttribute('href', MAILBOXES);

    await searchInput.press('Enter');
    await expect(page).toHaveURL(MAILBOXES);
    await expect(page.getByRole('heading', { level: 1 }).first()).toContainText('Mailboxes');
  });

  test('should navigate with Alt+1 and Alt+2, which also fire on macOS (G30-SRCH-04)', async ({ page }) => {
    await page.goto('/practice');
    await waitForShell(page);
    await page.keyboard.press('Alt+Digit1');
    await expect(page).toHaveURL('/curriculum');
    await waitForShell(page);
    await page.keyboard.press('Alt+Digit2');
    await expect(page).toHaveURL('/practice');
  });

  test('should go to the dashboard with Alt+3, and list it in the shortcuts help', async ({ page }) => {
    await page.keyboard.press('?');
    const help = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
    await expect(help.getByRole('cell', { name: 'Go to your dashboard' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(help).toHaveCount(0);

    await page.keyboard.press('Alt+Digit3');
    await expect(page).toHaveURL('/dashboard');
  });

  test('should list the shortcuts in a help dialog opened with "?" (G30-SRCH-05)', async ({ page }) => {
    await page.keyboard.press('?');
    const help = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
    await expect(help).toBeVisible();
    await expect(help.getByRole('cell', { name: 'Search lessons and sections' })).toBeVisible();
    await expect(help.getByRole('cell', { name: 'Next lesson' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(help).toHaveCount(0);

    await page.getByRole('contentinfo').getByRole('button', { name: 'Keyboard shortcuts' }).click();
    await expect(help).toBeVisible();
  });

  test('should show no account UI and request no account data on the default site (G30-SIDE-V07)', async ({ page }) => {
    test.skip(await accountUiEnabled(page), 'accountUI is on for this server; this checks the default build.');
    const accountRequests: string[] = [];
    page.on('request', (request) => {
      if (ACCOUNT_REQUEST.test(new URL(request.url()).pathname)) accountRequests.push(request.url());
    });
    await page.goto('/curriculum');
    await waitForShell(page);

    const banner = page.getByRole('banner');
    await expect(page.getByTestId('notification-button')).toHaveCount(0);
    await expect(page.getByTestId('user-profile-button')).toHaveCount(0);
    await expect(banner.getByText(/sign in|sign out/i)).toHaveCount(0);
    // The dashboard needs no account: it is in the main navigation (at 1280 px, in the bar itself).
    await expect(banner.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'href',
      '/dashboard',
    );

    await page.waitForLoadState('networkidle');
    expect(accountRequests).toEqual([]);
  });

  test('should show an accessible breadcrumb trail and a "Jump to" lesson list (G30-PAGE-05, G30-PAGE-14, G30-PAGE-V14)', async ({ page }) => {
    const lesson = '/curriculum/T2_Intermediate/I-UVM-3B_Advanced_Sequencing_and_Layering/sequence-arbitration';
    await page.goto(lesson);
    await waitForShell(page);

    // An ordered list; the last crumb is the current page; the tier opens its overview section.
    const breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' });
    const crumbs = breadcrumb.locator('ol > li');
    await expect(crumbs).toHaveCount(4);
    await expect(breadcrumb.locator('a[aria-current="page"]')).toHaveCount(1);
    await expect(crumbs.last().locator('a')).toHaveAttribute('aria-current', 'page');
    await expect(breadcrumb.getByRole('link', { name: 'Tier 2: Intermediate' })).toHaveAttribute('href', '/curriculum#t2');
    // Authoring status is not learner progress: no status icons in the trail.
    await expect(breadcrumb.locator('svg.lucide-clock')).toHaveCount(0);

    // "Jump to" is a disclosure with the module's lessons in order, not an ARIA menu.
    const jumpToButton = page.getByRole('button', { name: 'Jump to' });
    await expect(jumpToButton).toHaveAttribute('aria-expanded', 'false');
    await jumpToButton.click();
    await expect(jumpToButton).toHaveAttribute('aria-expanded', 'true');
    const panel = page.locator(`[id="${await jumpToButton.getAttribute('aria-controls')}"]`);
    await expect(panel.getByRole('link')).toHaveCount(9);
    await expect(panel.locator('a[aria-current="page"]')).toHaveAttribute('href', lesson);
    await page.keyboard.press('Escape');
    await expect(jumpToButton).toHaveAttribute('aria-expanded', 'false');
    await expect(jumpToButton).toBeFocused();
  });

});

test.describe('Lesson page shell', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(MAILBOXES);
    await waitForShell(page);
  });

  test('docks the course outline beside the lesson at 1280 px, with the current lesson marked (G30-SIDE-01)', async ({ page }) => {
    const outline = page.getByRole('navigation', { name: 'Course outline' });
    await expect(outline).toBeVisible();
    const current = outline.locator('[aria-current="page"]');
    await expect(current).toHaveCount(1);
    await expect(current).toHaveText(/Mailboxes/);
    await expect(current).toHaveAttribute('href', MAILBOXES);
    await expect(outline.getByRole('group', { name: /Electives/ })).toBeVisible();

    const outlineBox = await outline.boundingBox();
    const mainBox = await page.locator('#main-content').boundingBox();
    expect(outlineBox && mainBox && outlineBox.x + outlineBox.width <= mainBox.x + 1).toBeTruthy();

    // Hiding it is remembered, and the navbar button brings it back.
    await outline.getByRole('button', { name: 'Hide course outline' }).click();
    await expect(page.getByRole('navigation', { name: 'Course outline' })).toHaveCount(0);
    const toggle = page.getByRole('button', { name: 'Course outline', exact: true });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await expect(page.getByRole('navigation', { name: 'Course outline' })).toBeVisible();
  });

  test('skips to the lesson heading from the skip link (G30-PAGE-V18)', async ({ page }) => {
    const skip = page.getByRole('link', { name: 'Skip to main content' });
    await skip.focus();
    await expect(skip).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main-content h1').first()).toBeFocused();
  });

  test('moves between lessons with "[" and "]" (G30-SRCH-06)', async ({ page }) => {
    await page.keyboard.press(']');
    await expect(page).toHaveURL('/curriculum/T2_Intermediate/I-SV-5_Synchronization_and_IPC/semaphores');
    await waitForShell(page);
    await page.keyboard.press('[');
    await expect(page).toHaveURL(MAILBOXES);
  });

  test('jumps to the lesson\'s "On this page" list with "t" (G30-SRCH-06)', async ({ page }) => {
    const toc = page.getByRole('navigation', { name: 'On this page' });
    test.skip((await toc.count()) === 0, 'This lesson renders no "On this page" list.');
    await page.keyboard.press('t');
    await expect.poll(() => toc.evaluate((nav) => nav.contains(document.activeElement))).toBe(true);
  });

  test('deep-links a search result to its heading anchor', async ({ page }) => {
    const searchInput = page.getByTestId('main-search-input');
    await searchInput.fill('WSTRB any subset of the active lanes');
    const section = page.getByRole('listbox', { name: 'Search results' }).getByRole('option', { name: /WSTRB/ }).first();
    await expect(section).toHaveAttribute('href', /\/curriculum\/T3_Advanced\/B-AXI-2_AXI_Burst_Math\/index#wstrb-any-subset-of-the-active-lanes$/);
  });
});

test.describe('Phone layout (390 px)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('lists Dashboard in the phone menu with a visible focus ring, and the navbar does not overflow', async ({ page }) => {
    await page.goto('/curriculum');
    await waitForShell(page);

    const banner = page.getByRole('banner');
    expect(await banner.evaluate((header) => header.scrollWidth <= header.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    const menuButton = page.getByRole('button', { name: 'Open main menu' });
    await menuButton.focus();
    await page.keyboard.press('Enter');
    const menu = page.getByTestId('mobile-menu');
    await expect(menu).toBeVisible();
    const dashboard = menu.getByRole('link', { name: 'Dashboard' });
    await expect(dashboard).toBeVisible();
    await expect(dashboard).toHaveAttribute('href', '/dashboard');

    // Reach it from the keyboard, so the focus ring is the :focus-visible one.
    for (let step = 0; step < 12 && !(await dashboard.evaluate((link) => link === document.activeElement)); step += 1) {
      await page.keyboard.press('Tab');
    }
    await expect(dashboard).toBeFocused();
    expect(await dashboard.evaluate((link) => getComputedStyle(link).boxShadow)).not.toBe('none');

    await dashboard.press('Enter');
    await expect(page).toHaveURL('/dashboard');
  });
});

test.describe('Tablet layout (768 px)', () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  test('fits the md bar without sideways scrolling, with Dashboard under "More"', async ({ page }) => {
    await page.goto('/curriculum');
    await waitForShell(page);
    // With accounts on, the account menu (and, signed in, the bell) do not fit yet; the accounts-mode check below covers that.
    test.skip(await accountUiEnabled(page), 'accountUI is on for this server; this checks the default build.');

    const banner = page.getByRole('banner');
    await expect(banner.getByRole('combobox', { name: 'Select theme' })).toBeVisible();
    expect(await banner.evaluate((header) => header.scrollWidth <= header.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    const nav = banner.getByRole('navigation', { name: 'Main' });
    for (const name of ['Start here', 'Curriculum', 'Practice']) {
      await expect(nav.getByRole('link', { name, exact: true })).toBeVisible();
    }
    const more = nav.getByRole('button', { name: 'More' });
    await more.click();
    await expect(more).toHaveAttribute('aria-expanded', 'true');
    await expect(nav.getByRole('link', { name: 'Dashboard' })).toBeVisible();
  });
});

test.describe('Account menus (accounts mode)', () => {
  requireAccountsMode(test);

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/curriculum');
    await waitForShell(page);
  });

  test('offers a signed-out visitor Sign in, back to this page, and no notification bell', async ({ page }) => {
    const banner = page.getByRole('banner');
    const account = banner.getByTestId('user-profile-button');
    await expect(account).toBeVisible();
    await expect(banner.getByTestId('notification-button')).toHaveCount(0);

    await account.click();
    await expect(account).toHaveAttribute('aria-expanded', 'true');
    await expect(banner.getByText('Not signed in')).toBeVisible();
    await expect(banner.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/api/auth/signin?callbackUrl=%2Fcurriculum',
    );
    await expect(banner.getByRole('link', { name: 'Settings' })).toBeVisible();
    await expect(banner.getByRole('button', { name: 'Sign out' })).toHaveCount(0);

    await page.keyboard.press('Escape');
    await expect(account).toHaveAttribute('aria-expanded', 'false');
    await expect(account).toBeFocused();
  });

  test('opens the account and notification menus for a signed-in learner', async ({ page }) => {
    await authenticateTestLearner(page);
    await page.reload();
    await waitForShell(page);
    const banner = page.getByRole('banner');

    const account = banner.getByTestId('user-profile-button');
    await account.click();
    await expect(account).toHaveAttribute('aria-expanded', 'true');
    await expect(banner.getByRole('link', { name: 'Settings' })).toBeVisible();
    await expect(banner.getByRole('button', { name: 'Sign out' })).toBeVisible();
    await expect(banner.getByRole('link', { name: 'Sign in' })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(account).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByText('Jane Doe')).toHaveCount(0);

    const bell = banner.getByTestId('notification-button');
    await bell.click();
    await expect(bell).toHaveAttribute('aria-expanded', 'true');
    await expect(banner.getByText('Notifications', { exact: true }).first()).toBeVisible();
    await expect(banner.getByRole('link', { name: 'View all' })).toHaveAttribute('href', '/notifications');
  });

  // Open item, kept as a check for when accounts are turned on: from md to lg the
  // account menu and the bell add about 88 px to a bar that has 720 px of room at
  // 768 px, so it overflows (see the Navbar component's comment). Turn this into
  // a plain test once the md bar makes room for them.
  test.fixme('fits the md bar at 768 px for a signed-in learner', async ({ page }) => {
    await authenticateTestLearner(page);
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.reload();
    await waitForShell(page);
    const banner = page.getByRole('banner');
    await expect(banner.getByTestId('notification-button')).toBeVisible();
    await expect(banner.getByTestId('user-profile-button')).toBeInViewport({ ratio: 1 });
    expect(await banner.evaluate((header) => header.scrollWidth <= header.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
