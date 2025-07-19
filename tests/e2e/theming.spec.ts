import { test, expect } from '@playwright/test';

test.describe('Theme and Styling Verification', () => {
  test('should apply correct default (dark) theme styles', async ({ page }) => {
    await page.goto('/');
    const body = page.locator('body');
    await expect(body).toHaveCSS('background-color', 'rgb(2, 8, 23)');
  });

  test('should toggle theme and apply correct styles to InteractiveCode', async ({ page }) => {
    await page.goto('/uvm-concepts/uvm-virtual-sequencer');

    const interactiveCode = page.getByTestId('interactive-code');

    // Check initial (dark) theme
    await expect(interactiveCode).toHaveCSS('background-color', 'rgb(2, 8, 23)');
    await expect(interactiveCode).toHaveCSS('border-color', 'rgb(30, 41, 59)');

    // Toggle theme
    await page.getByRole('button', { name: 'Toggle theme' }).click();

    // Check light theme
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(interactiveCode).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(interactiveCode).toHaveCSS('border-color', 'rgb(226, 232, 240)');
  });
});


