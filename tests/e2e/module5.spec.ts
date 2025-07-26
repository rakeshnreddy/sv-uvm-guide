import { test, expect } from '@playwright/test';

test('Module 5 InteractiveCode highlights lines', async ({ page }) => {
  await page.goto('/curriculum/T3_Advanced/A-UVM-3_Advanced_UVM_Techniques');
  const ic = page.getByTestId('interactive-code').first();
  await expect(ic).toBeVisible();
  const codeBlock = ic.locator('pre');
  await expect(codeBlock).toHaveCSS('overflow-x', 'auto');
  await ic.getByRole('button', { name: 'Next' }).click();
  const highlighted = ic.locator('[style*="background-color"]');
  await expect(highlighted).not.toHaveCount(0);
});
