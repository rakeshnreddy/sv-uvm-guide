import { test, expect } from '@playwright/test';

test('Module 5 code sample renders SystemVerilog snippet', async ({ page }) => {
  await page.goto('/curriculum/T3_Advanced/A-UVM-1_Advanced_Sequencing/index');

  const codeSnippet = page.locator('pre').first();
  await expect(codeSnippet).toContainText('class soc_virtual_seq');
  await expect(codeSnippet).toContainText('`uvm_object_utils(soc_virtual_seq)');
});
