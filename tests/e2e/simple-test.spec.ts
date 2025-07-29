import { test, expect } from '@playwright/test';

test('should successfully load the home page', async ({ page }) => {
  await page.goto('/');
  const heading = page.locator('h1');
  await expect(heading).toHaveText('Welcome to the SystemVerilog & UVM Guide');
});
