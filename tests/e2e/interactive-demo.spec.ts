import { test, expect } from '@playwright/test';

test.describe('Interactive Demo Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/practice/interactive-demo');
  });

  test('should display the main title', async ({ page }) => {
    // The page can be slow to load with the new components, so wait for a key element to be visible
    await expect(page.locator('h2:has-text("Enhanced Interactive Code")')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('h1')).toContainText('Interactive Components Demo');
  });

  test('should display and interact with the InteractiveCode component', async ({ page }) => {
    await expect(page.locator('h2:has-text("Enhanced Interactive Code")')).toBeVisible();

    // Check for Monaco editor instance
    await expect(page.locator('.monaco-editor')).toBeVisible();

    // Check initial explanation text
    await expect(page.getByText('This section declares the SystemVerilog module and its signals.')).toBeVisible();

    // Click next and check for new explanation
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText('This `initial` block creates a free-running clock with a 10ns period.')).toBeVisible();
    await expect(page.locator('span:has-text("Step 2 of 5")')).toBeVisible();
  });

  test('should run the simulation in the CodeExecutionEnvironment', async ({ page }) => {
    await expect(page.locator('h2:has-text("Code Execution Environment")')).toBeVisible();

    const outputPanel = page.locator('pre');
    await expect(outputPanel).toContainText('Click "Run Simulation" to see the output.');

    // Run with default backend
    await page.getByRole('button', { name: 'Run Simulation' }).click();
    await expect(outputPanel).toContainText('Simulation PASSED', { timeout: 3000 });

    // Switch backend and run again to ensure selection works
    await page.locator('select').selectOption('verilator');
    await page.getByRole('button', { name: 'Run Simulation' }).click();
    await expect(outputPanel).toContainText('[Verilator] Running', { timeout: 3000 });
  });

  test('should display the placeholder components', async ({ page }) => {
    await expect(page.locator('h2:has-text("Code Challenge System")')).toBeVisible();
    await expect(page.locator('h2:has-text("Debugging Simulator")')).toBeVisible();
    await expect(page.locator('h2:has-text("Code Review Assistant")')).toBeVisible();
  });
});
