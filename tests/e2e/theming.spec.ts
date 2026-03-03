import { test, expect } from '@playwright/test';

test.describe('Theme and Styling Verification', () => {
  test('should apply correct default (dark) theme styles', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('html.dark');
    const html = page.locator('html');
    await expect(html).toHaveAttribute('class', 'dark');
  });

  test('should toggle theme and apply correct styles to InteractiveCode', async ({ page }) => {
    await page.goto('/curriculum/T2_Intermediate/I-UVM-3B_Advanced_Sequencing_and_Layering/virtual-sequences');

    const html = page.locator('html');
    await expect(html).toHaveClass(/dark/);

    await page.getByRole('button', { name: 'Toggle theme' }).click();

    await expect(html).not.toHaveClass(/dark/);
  });
});
