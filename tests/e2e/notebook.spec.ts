import { test, expect } from '@playwright/test';

test('Notebook E2E flow', async ({ page }) => {
  // Navigate to a curriculum page
  await page.goto('/curriculum/sv-foundations/data-types');

  // Click the 'Explain in Notebook' button
  await page.click('text=Explain in Notebook');

  // Verify navigation to the notebook
  await expect(page).toHaveURL('/dashboard/notebook');

  // Verify that a new entry exists
  // This is a simplified check. In a real app, you'd check for a specific title.
  await expect(page.locator('text=UVM Phases')).toBeVisible();

  // Type 'This is my explanation.' into the rich text editor
  await page.locator('textarea').fill('This is my explanation.');

  // Click 'Submit for AI Feedback'
  await page.click('text=Submit for AI Feedback');

  // Wait for the mock response and assert that the feedback text is displayed
  await expect(page.locator('text=This is a good summary...')).toBeVisible();
});
