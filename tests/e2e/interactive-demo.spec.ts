import { test, expect } from '@playwright/test';

test.describe('Interactive Demo Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/practice/interactive-demo');
  });

  test('should display the interactive simulation environment and allow running a simulation', async ({ page }) => {
    // Set a longer timeout for this test as it loads several heavy components
    test.setTimeout(30000);

    // Check for the main page title
    await expect(page.locator('h1')).toContainText('Interactive Components Demo', { timeout: 10000 });

    // Check that the main container for the interactive environment is visible
    const mainContainerTitle = page.locator('h2:has-text("Interactive Simulation Environment")');
    await expect(mainContainerTitle).toBeVisible();

    // Check for the Monaco editor instance
    const editor = page.locator('.monaco-editor');
    await expect(editor).toBeVisible();

    // Check that the initial code is loaded
    await expect(editor).toContainText('Hello, World!');

    // Get the run button and the output panel
    const runButton = page.getByRole('button', { name: 'Run Simulation' });
    const outputPanel = page.locator('pre');

    // Verify initial state
    await expect(runButton).toBeEnabled();
    await expect(outputPanel).toContainText('Click "Run Simulation" to see the output.');

    // Click the run button and wait for the results
    await runButton.click();
    await expect(runButton).toBeDisabled();

    // Check for the actual output from the simulation
    await expect(outputPanel).toContainText('Hello, World! Welcome to the interactive simulation.', { timeout: 10000 });
    await expect(outputPanel).toContainText('Simulation finished at time 10.');

    // Check that the run button is enabled again
    await expect(runButton).toBeEnabled();
  });

  test('should display the placeholder components for future features', async ({ page }) => {
    await expect(page.locator('h2:has-text("Future Components")')).toBeVisible();
    await expect(page.locator('h2:has-text("Code Challenge System")')).toBeVisible();
    await expect(page.locator('h2:has-text("Debugging Simulator")')).toBeVisible();
    await expect(page.locator('h2:has-text("Code Review Assistant")')).toBeVisible();
  });
});
