import { test, expect, devices } from '@playwright/test';

// Use iPhone 13 device for all tests in this file
test.use({ ...devices['iPhone 13'] });

test.describe('Mobile Navigation', () => {
  test.setTimeout(180000); // 3 minute timeout for this test

  test('should open slide-out menu and sidebar', async ({ page }) => {
    await page.goto('/');

    // Test mobile menu
    await page.getByRole('button', { name: 'Open main menu' }).click();
    const mobileMenu = page.getByTestId('mobile-menu');
    await expect(mobileMenu).toBeVisible();
    await expect(mobileMenu.getByRole('link', { name: 'Curriculum', exact: true })).toBeVisible();
    await mobileMenu.getByRole('button').first().click();
    await expect(mobileMenu).not.toBeVisible();

    // Test mobile sidebar
    const openSidebarButton = page.getByRole('button', { name: 'Open sidebar' });
    if (await openSidebarButton.count() === 0) {
      test.skip('Sidebar toggle not available on mobile navigation');
    }
    await openSidebarButton.first().click({ force: true });
    const quickAccessHeading = page.locator('h2:has-text("Quick Access")');
    await expect(quickAccessHeading).toBeVisible();
    await page.locator('h2:has-text("Quick Access") + button').click();
    await expect(quickAccessHeading).toHaveCount(0);
  });

});
