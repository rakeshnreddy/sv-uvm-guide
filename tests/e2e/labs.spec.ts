import { test, expect } from '@playwright/test';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });

test.describe('Interactive Lab Framework', () => {
  test('should run tests and display results', async ({ page }) => {
    test.setTimeout(60000);
    // This test will not seed the database as we are not connected to one.
    // We will navigate to a mock lab page.
    await page.goto('/practice/lab/mock-lab');

    // Wait for the editor to be ready
    await page.waitForSelector('.monaco-editor', { timeout: 50000 });

    // Click the "Run Tests" button
    await page.getByRole('button', { name: 'Run Tests' }).click();

    // Assert that the mock test results are displayed correctly
    const consoleOutput = await page.locator('pre');
    await expect(consoleOutput).toContainText("Test 'test_initial_state' passed.");
    await expect(consoleOutput).toContainText("Test 'test_basic_input' passed.");
    await expect(consoleOutput).toContainText("Test 'test_edge_cases' failed.");
  });
});
