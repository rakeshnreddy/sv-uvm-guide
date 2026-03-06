import { test, expect } from '@playwright/test';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });

test.describe('Interactive Lab Framework', () => {
  test('should load a registered lab and evaluate incorrect code', async ({ page }) => {
    test.setTimeout(60000);
    // Navigate to a real registered lab
    await page.goto('/practice/lab/basics-1');

    // Wait for the editor to be ready
    await page.waitForSelector('.monaco-editor', { timeout: 50000 });

    // Ensure the title is correct
    await expect(page.locator('h2')).toContainText('SV Basics: Variables and Assignment');

    // Click the "Check Solution" button without writing the right code
    await page.getByRole('button', { name: 'Check Solution' }).click();

    // Assert that the grader output displays
    const consoleOutput = await page.locator('pre');
    await expect(consoleOutput).toContainText("Hint: Make sure you declare a variable named 'myVar' of type 'int'.");
  });
  
  test('should return 404 for an unregistered lab', async ({ page }) => {
    const response = await page.goto('/practice/lab/this-is-not-a-lab');
    expect(response?.status()).toBe(404);
  });
});
