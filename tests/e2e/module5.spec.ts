import { test, expect } from '@playwright/test';

test('Module 5 InteractiveCode highlights lines', async ({ page }) => {
  await page.goto('/curriculum/T3_Advanced/A-UVM-1_Advanced_Sequencing/index');
  const ic = page.getByTestId('interactive-code').first();
  console.log('Found interactive code element:', await ic.innerHTML());
  await expect(ic).toBeVisible();
  // Verify that the Monaco editor is now present instead of a simple <pre> tag
  const codeBlock = ic.locator('.monaco-editor');
  await expect(codeBlock).toBeVisible();

  const nextButton = ic.getByRole('button', { name: 'Next' });
  if (await nextButton.isEnabled()) {
    await nextButton.click();
  }
  // The new implementation uses a class for highlighting, not an inline style
  const highlighted = ic.locator('.monaco-highlighted-line');
  await expect(highlighted).toHaveCount(1);
});
