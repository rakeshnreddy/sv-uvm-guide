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

  test('history timeline chart renders on the draft history page', async ({ page }) => {
    // /history is a draft page: it answers 404 unless draft pages are on
    // (personalization). Flags are inlined at build time, so ask the server.
    const flags = await (await page.request.get('/api/feature-flags')).json();
    test.skip(!flags.personalization, 'Draft pages are off on this server, so /history answers 404 (feature-flags.spec checks that).');

    const response = await page.goto('/history');
    expect(response?.status()).toBe(200);
    const chart = page.getByTestId('history-timeline-chart');
    await expect(chart).toBeVisible();
    const svg = chart.locator('svg').first();
    await expect(svg).toBeVisible();
    const pointCount = await svg.locator('[data-role="timeline-point"]').count();
    expect(pointCount).toBeGreaterThan(0);
  });
});
