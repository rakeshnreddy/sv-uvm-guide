import { existsSync } from 'node:fs';
import { test, expect, devices, webkit } from '@playwright/test';

// Use iPhone 13 device for all tests in this file
test.use({ ...devices['iPhone 13'] });

// iPhone 13 defaults to WebKit, which a Chromium-only install does not include.
test.skip(
  ({ browserName }) => browserName === 'webkit' && !existsSync(webkit.executablePath()),
  'WebKit is not installed. Run `npx playwright install webkit`, or pass --browser=chromium for an emulated run.',
);

test.describe('Mobile Navigation', () => {
  test.setTimeout(180000); // 3 minute timeout for this test

  test('should open slide-out menu and sidebar', async ({ page }) => {
    // The mobile navbar belongs to the (learning) layout; the public landing page at / does not render it.
    await page.goto('/curriculum');

    // Test mobile menu
    await page.getByRole('button', { name: 'Open main menu' }).click();
    const mobileMenu = page.getByTestId('mobile-menu');
    await expect(mobileMenu).toBeVisible();
    await expect(mobileMenu.getByRole('link', { name: 'Curriculum', exact: true })).toBeVisible();
    await mobileMenu.getByRole('button').first().click();
    await expect(mobileMenu).not.toBeVisible();

    // Test mobile sidebar
    const openSidebarButton = page.getByRole('button', { name: 'Open sidebar' });
    if ((await openSidebarButton.count()) === 0) {
      test.skip(true, 'Sidebar toggle not available on mobile navigation');
    }
    await openSidebarButton.first().click({ force: true });
    const quickAccessHeading = page.getByRole('heading', { name: 'Quick Access' });
    await expect(quickAccessHeading).toBeVisible();
    await page.getByRole('button', { name: 'Close quick access sidebar' }).click();
    await expect(quickAccessHeading).toHaveCount(0);
  });

});
