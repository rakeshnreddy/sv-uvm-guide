import { test, expect } from '@playwright/test';

test('factory link navigates to phasing page', async ({ page }) => {
  await page.goto('/curriculum/uvm-core/fundamentals/factory');
  await page.click('a:has-text("Phasing")');
  await expect(page).toHaveURL('/curriculum/uvm-core/fundamentals/phasing');
  await expect(page.locator('h1')).toContainText('Phasing');
});
