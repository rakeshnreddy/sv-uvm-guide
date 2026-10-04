import { test, expect, type Page } from '@playwright/test';

test('sequence arbitration page next link navigates to sequence libraries', async ({ page }) => {
  await page.goto('/curriculum/T2_Intermediate/I-UVM-3B_Advanced_Sequencing_and_Layering/sequence-arbitration');
  const nextLessonLink = page.getByRole('link', { name: /^Next lesson Sequence Libraries & Arbitration Control/i });
  await expect(nextLessonLink, 'Next lesson link should be rendered once').toHaveCount(1);
  await nextLessonLink.click();
  await expect(page).toHaveURL('/curriculum/T2_Intermediate/I-UVM-3B_Advanced_Sequencing_and_Layering/sequence-libraries');
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

  test('should hide account UI unless accountUI is on (G30-SIDE-V07)', async ({ page }) => {
    test.skip(await accountUiEnabled(page), 'accountUI is on for this server; this checks the default build.');
    await expect(page.getByTestId('notification-button')).toHaveCount(0);
    await expect(page.getByTestId('user-profile-button')).toHaveCount(0);
    await expect(page.getByText(/sign out/i)).toHaveCount(0);
  });

  test('should open the account and notification menus on click when accountUI is enabled', async ({ page }) => {
    test.skip(
      !(await accountUiEnabled(page)),
      'accountUI is off on this server. Rebuild with NEXT_PUBLIC_FEATURE_FLAG_ACCOUNT_UI=true (inlined at build time), '
        + 'or let playwright.config.ts start its own next dev server, which turns every flag on.',
    );

    const account = page.getByTestId('user-profile-button');
    await account.click();
    await expect(account).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(account).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByText('Jane Doe')).toHaveCount(0);

    await page.getByTestId('notification-button').click();
    await expect(page.getByText('Notifications', { exact: true }).first()).toBeVisible();
  });

  test('should link to the notifications hub when accountUI is enabled', async ({ page }) => {
    test.skip(
      !(await accountUiEnabled(page)),
      'accountUI is off on this server. Rebuild with NEXT_PUBLIC_FEATURE_FLAG_ACCOUNT_UI=true (inlined at build time), '
        + 'or let playwright.config.ts start its own next dev server, which turns every flag on.',
    );

    await page.getByTestId('notification-button').click();
    await expect(page.getByRole('link', { name: 'View all' })).toBeVisible();
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
    await searchInput.fill('WSTRB write strobe');
    const section = page.getByRole('listbox', { name: 'Search results' }).getByRole('option', { name: /WSTRB/ }).first();
    await expect(section).toHaveAttribute('href', /\/curriculum\/T3_Advanced\/B-AXI-2_AXI_Burst_Math\/index#3-wstrb--write-strobe-generation$/);
  });
});
