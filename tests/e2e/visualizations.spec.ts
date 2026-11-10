import { test, expect } from '@playwright/test';

test.describe('Charts and visualizations', () => {
  test('data type comparison chart renders', async ({ page }) => {
    await page.goto('/practice/visualizations/data-type-comparison');
    const chart = page.getByTestId('data-type-chart');
    await expect(chart).toBeVisible();
    const svg = chart.locator('svg').first();
    await expect(svg).toBeVisible();
    const barCount = await svg.locator('rect').count();
    expect(barCount).toBeGreaterThan(0);
  });

  test('history timeline chart renders on the public history page', async ({ page }) => {
    const response = await page.goto('/history');
    expect(response?.status()).toBe(200);
    const chart = page.getByTestId('history-timeline-chart');
    await expect(chart).toBeVisible();
    await expect(chart.locator('svg').first()).toBeVisible();
    const pointCount = await chart.locator('svg [data-role="timeline-point"]').count();
    expect(pointCount).toBeGreaterThan(0);
  });
});
