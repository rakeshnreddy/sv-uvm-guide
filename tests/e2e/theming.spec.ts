import { test, expect } from '@playwright/test';

test.describe('Theming and Styling', () => {
  test('should correctly apply light and dark theme styles', async ({ page }) => {
    // Navigate to a page that displays the components
    await page.goto('/community');
    await page.waitForURL('/community');

    // Ensure the theme is set to light
    await page.emulateMedia({ colorScheme: 'light' });

    // Take a screenshot of the entire page
    await expect(page).toHaveScreenshot('theming-light.png');

    // Ensure the theme is set to dark
    await page.emulateMedia({ colorScheme: 'dark' });

    // Take a screenshot of the entire page
    await expect(page).toHaveScreenshot('theming-dark.png');
  });
});
