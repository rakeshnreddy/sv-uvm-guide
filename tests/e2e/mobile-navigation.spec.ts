import { test, expect, devices } from '@playwright/test';

// Use iPhone 13 device for all tests in this file
test.use({ ...devices['iPhone 13'] });

test.describe('Mobile Navigation', () => {
  test.setTimeout(180000); // 3 minute timeout for this test

  test('should open slide-out menu and sidebar', async ({ page }) => {
    await page.goto('/');

    // Test mobile menu
    await page.getByRole('button', { name: 'Open main menu' }).click();
    await expect(page.locator('h2:has-text("Menu")')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Curriculum' })).toBeVisible();
    await page.locator('h2:has-text("Menu") + button').click();
    await expect(page.locator('h2:has-text("Menu")')).not.toBeVisible();

    // Test mobile sidebar
    await page.getByLabel('Open sidebar').click();
    await expect(page.locator('h2:has-text("Quick Access")')).toBeVisible();
    await page.locator('h2:has-text("Quick Access") + button').click();
    await expect(page.locator('h2:has-text("Quick Access")')).not.toBeVisible();
  });

});
