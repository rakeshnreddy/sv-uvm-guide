import { test, expect } from '@playwright/test';

test.describe('Theme and Styling Verification', () => {
  test('should apply correct default (dark) theme styles', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('html.dark');
    const html = page.locator('html');
    await expect(html).toHaveAttribute('class', 'dark');
  });

  test('should toggle theme and apply correct styles to InteractiveCode', async ({ page }) => {
    await page.goto('/curriculum/T3_Advanced/A-UVM-1_Advanced_Sequencing/index');

    const interactiveCode = page.getByTestId('interactive-code').first();

    // Check initial (dark) theme
    await expect(interactiveCode).toHaveCSS('background-color', 'rgba(255, 255, 255, 0.1)');
    await expect(interactiveCode).toHaveCSS('border-color', 'rgba(255, 255, 255, 0.2)');

    // Toggle theme
    await page.getByRole('button', { name: 'Toggle theme' }).click();

    // Check light theme
    await expect(page.locator('body')).not.toHaveAttribute('class', 'dark');
    await expect(interactiveCode).toHaveCSS('background-color', 'rgba(255, 255, 255, 0.1)');
    await expect(interactiveCode).toHaveCSS('border-color', 'rgba(255, 255, 255, 0.2)');
  });
});


