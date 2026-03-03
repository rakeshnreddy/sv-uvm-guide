import { test, expect } from '@playwright/test';

test('Module 5 code sample renders SystemVerilog snippet', async ({ page }) => {
  await page.goto('/curriculum/T2_Intermediate/I-UVM-3B_Advanced_Sequencing_and_Layering/virtual-sequences');

  const codeSnippet = page.locator('.monaco-editor').first();
  await expect(codeSnippet).toBeVisible();
});
