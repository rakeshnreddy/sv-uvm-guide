import { test, expect } from '@playwright/test';

test.describe('Charts and visualizations', () => {
  test('data type comparison chart renders', async ({ page }) => {
    await page.goto('/practice/visualizations/data-type-comparison');
    const svg = page.locator('svg');
    await expect(svg).toBeVisible();
    const barCount = await page.locator('svg rect').count();
    expect(barCount).toBeGreaterThan(0);
  });

  test('history timeline chart renders', async ({ page }) => {
    await page.goto('/history');
    const svg = page.locator('svg');
    await expect(svg).toBeVisible();
    const pointCount = await page.locator('svg circle').count();
    expect(pointCount).toBeGreaterThan(0);
  });
});
