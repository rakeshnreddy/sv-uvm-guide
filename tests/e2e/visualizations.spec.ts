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

  test('history timeline chart renders', async ({ page }) => {
    await page.goto('/history');
    const chart = page.getByTestId('history-timeline-chart');
    if (await chart.count()) {
      await expect(chart).toBeVisible();
      const svg = chart.locator('svg').first();
      await expect(svg).toBeVisible();
      const pointCount = await svg.locator('[data-role="timeline-point"]').count();
      expect(pointCount).toBeGreaterThan(0);
    } else {
      await expect(
        page.getByText(/history module is paused until we have real learner tracking data/i),
      ).toBeVisible();
    }
  });
});
