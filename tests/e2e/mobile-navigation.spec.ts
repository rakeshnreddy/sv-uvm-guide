import { existsSync } from 'node:fs';
import { test, expect, devices, webkit } from '@playwright/test';

// Use iPhone 13 device for all tests in this file
test.use({ ...devices['iPhone 13'] });

// iPhone 13 defaults to WebKit, which a Chromium-only install does not include.
test.skip(
  ({ browserName }) => browserName === 'webkit' && !existsSync(webkit.executablePath()),
  'WebKit is not installed. Run `npx playwright install webkit`, or pass --browser=chromium for an emulated run.',
);

const MAILBOXES = '/curriculum/T2_Intermediate/I-SV-5_Synchronization_and_IPC/mailboxes';

test.describe('Mobile Navigation', () => {
  test.setTimeout(180000); // 3 minute timeout for this test

  test.beforeEach(async ({ page }) => {
    // The mobile navbar belongs to the (learning) layout; the public landing page at / does not render it.
    await page.goto('/curriculum');
    await page.locator('html[data-shortcuts-ready]').waitFor({ state: 'attached' });
  });

  test('should open slide-out menu and the course outline drawer', async ({ page }) => {
    // Test mobile menu
    await page.getByRole('button', { name: 'Open main menu' }).click();
    const mobileMenu = page.getByTestId('mobile-menu');
    await expect(mobileMenu).toBeVisible();
    await expect(mobileMenu.getByRole('link', { name: 'Curriculum', exact: true })).toBeVisible();
    await mobileMenu.getByRole('button').first().click();
    await expect(mobileMenu).not.toBeVisible();

    // Test the course outline drawer (it replaced the "Quick Access" sidebar)
    const outlineButton = page.getByRole('button', { name: 'Course outline', exact: true });
    await outlineButton.click();
    const outlineHeading = page.getByRole('heading', { name: 'Course outline' });
    await expect(outlineHeading).toBeVisible();
    await page.getByRole('button', { name: 'Close course outline' }).click();
    await expect(outlineHeading).toHaveCount(0);
  });

  test('should list the current module\'s lessons in the outline drawer on a lesson', async ({ page }) => {
    await page.goto(MAILBOXES);
    await page.locator('html[data-shortcuts-ready]').waitFor({ state: 'attached' });
    // Below lg the docked column is hidden; the drawer takes over.
    await expect(page.getByRole('navigation', { name: 'Course outline' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Course outline', exact: true }).click();
    const drawer = page.getByRole('dialog', { name: 'Course outline' });
    await expect(drawer).toBeVisible();
    for (const lesson of ['Events', 'Mailboxes', 'Semaphores']) {
      await expect(drawer.getByRole('link', { name: lesson, exact: true })).toBeVisible();
    }
    await expect(drawer.locator('[aria-current="page"]')).toHaveText(/Mailboxes/);

    // The backdrop closes it.
    await page.getByTestId('course-outline-backdrop').click({ position: { x: 370, y: 400 } });
    await expect(drawer).toHaveCount(0);
  });

  test('should open search from the search button (G30-SRCH-02)', async ({ page }) => {
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Search the curriculum' });
    await expect(dialog).toBeVisible();
    const field = dialog.getByRole('combobox', { name: 'Search lessons and sections' });
    await expect(field).toBeFocused();
    await field.fill('mailbox');
    await expect(dialog.getByRole('option').first()).toBeVisible();
    await field.press('Enter');
    await expect(page).toHaveURL(MAILBOXES);
    await expect(dialog).toHaveCount(0);
  });

  test('should fit the navbar, footer, outline drawer and search dialog in 390 px', async ({ page }) => {
    const fits = async (selector: string) =>
      page.locator(selector).first().evaluate((el) => {
        const box = el.getBoundingClientRect();
        return box.left >= -1 && box.right <= window.innerWidth + 1 && el.scrollWidth <= el.clientWidth + 1;
      });

    await page.goto(MAILBOXES);
    await page.locator('html[data-shortcuts-ready]').waitFor({ state: 'attached' });
    expect(await fits('header')).toBe(true);
    expect(await fits('footer')).toBe(true);

    await page.getByRole('button', { name: 'Course outline', exact: true }).click();
    expect(await fits('[role="dialog"]')).toBe(true);
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Search', exact: true }).click();
    expect(await fits('[role="dialog"]')).toBe(true);
  });

  test('should open the course outline from the menu (responsive-a11y-14)', async ({ page }) => {
    await page.getByRole('button', { name: 'Open main menu' }).click();
    const mobileMenu = page.getByTestId('mobile-menu');
    await mobileMenu.getByRole('button', { name: 'Course outline' }).click();
    await expect(mobileMenu).toHaveCount(0);
    const drawer = page.getByRole('dialog', { name: 'Course outline' });
    await expect(drawer).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(drawer).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Open main menu' })).toBeFocused();
  });

  test('should offer the theme controls and the learner pages in the menu (navigation-6, responsive-a11y-3)', async ({ page }) => {
    await page.getByRole('button', { name: 'Open main menu' }).click();
    const mobileMenu = page.getByTestId('mobile-menu');
    const appearance = mobileMenu.getByRole('region', { name: 'Appearance' });
    const select = appearance.getByRole('combobox', { name: 'Select theme' });
    const toggle = appearance.getByRole('button', { name: 'Toggle theme' });
    await expect(select).toBeVisible();
    for (const control of [select, toggle]) {
      const box = await control.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(40);
      expect(box!.height).toBeLessThanOrEqual(44);
    }
    const learning = mobileMenu.getByRole('navigation', { name: 'Your learning' });
    for (const name of ['Settings', 'Self-assessment', 'Find your level']) {
      await expect(learning.getByRole('link', { name, exact: true })).toBeVisible();
    }

    // The choice applies at once and survives a reload.
    await select.selectOption('forest');
    await expect(page.locator('html')).toHaveAttribute('data-theme', /^forest-/);
    await toggle.click();
    const theme = await page.evaluate(() => localStorage.getItem('theme'));
    expect(theme).toMatch(/^forest-(light|dark)$/);
    await page.reload();
    await page.locator('html[data-shortcuts-ready]').waitFor({ state: 'attached' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme!);
  });
});
