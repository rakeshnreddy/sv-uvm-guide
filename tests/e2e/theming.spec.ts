import { test, expect } from '@playwright/test';

test.describe('Theming and Styling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should have the correct background color for light mode', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    const body = page.locator('body');
    await expect(body).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  });

  test('should have the correct background color for dark mode', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    const body = page.locator('body');
    await expect(body).toHaveCSS('background-color', 'rgb(9, 9, 11)');
  });
});
