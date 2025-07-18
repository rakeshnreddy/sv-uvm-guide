import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should navigate to the sv-concepts page', async ({ page }) => {
    await page.click('text=SV Concepts');
    await expect(page).toHaveURL('/sv-concepts');
  });

  test('should navigate to the uvm-concepts page', async ({ page }) => {
    await page.click('text=UVM Concepts');
    await expect(page).toHaveURL('/uvm-concepts');
  });

  test('should navigate to the exercises page', async ({ page }) => {
    await page.click('text=Exercises');
    await expect(page).toHaveURL('/exercises');
  });

  test('should navigate to the dashboard page', async ({ page }) => {
    await page.getByTestId('hero-section').getByText('Dashboard').click();
    await expect(page).toHaveURL('/dashboard');
  });

  test('should navigate to the community page', async ({ page }) => {
    await page.getByTestId('hero-section').getByText('Community').click();
    await expect(page).toHaveURL('/community');
  });
});
