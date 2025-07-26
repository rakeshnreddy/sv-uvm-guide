import { test, expect } from '@playwright/test';

test('Module 5 InteractiveCode highlights lines', async ({ page }) => {
  await page.goto('/curriculum/T3_Advanced/A-UVM-1_Advanced_Sequencing/index');
  const ic = page.getByTestId('interactive-code').first();
  console.log('Found interactive code element:', await ic.innerHTML());
  await expect(ic).toBeVisible();
  const codeBlock = ic.locator('pre');
  await expect(codeBlock).toHaveCSS('overflow-x', 'auto');
  const nextButton = ic.getByRole('button', { name: 'Next' });
  if (await nextButton.isEnabled()) {
    await nextButton.click();
  }
  const highlighted = ic.locator('[style*="background-color"]');
  await expect(highlighted).not.toHaveCount(0);
});
