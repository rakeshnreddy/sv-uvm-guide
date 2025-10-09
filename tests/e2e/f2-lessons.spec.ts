import { test, expect } from '@playwright/test';

test.describe('Tier 1 F2 micro-lessons', () => {
  test('F2B dynamic structures explorer responds to interactions', async ({ page }) => {
    await page.goto('/curriculum/T1_Foundational/F2B_Dynamic_Structures/');
    const explorer = page.getByTestId('data-type-explorer');
    await expect(explorer).toBeVisible();

    await page.getByTestId('dynamic-push-back').click();
    await expect(page.getByTestId('dynamic-array-console-log')).toContainText('arr.push_back');

    await page.getByRole('button', { name: /queue/i }).click();
    await page.getByTestId('queue-pop-front').click();
    await expect(page.getByTestId('queue-console-log')).toContainText('q.pop_front');
  });

  test('F2C blocking simulator toggles modes', async ({ page }) => {
    await page.goto('/curriculum/T1_Foundational/F2C_Procedural_Code/');
    const simulator = page.getByTestId('blocking-simulator');
    await expect(simulator).toBeVisible();

    await simulator.getByRole('button', { name: /next/i }).click();
    await expect(page.getByTestId('timeline-panel')).toContainText('Step 2');

    await simulator.getByRole('button', { name: /non-blocking mode/i }).click();
    await expect(page.getByTestId('blocking-code')).toContainText('out <= shared');
  });

  test('F2D lesson links to the refactoring lab', async ({ page }) => {
    await page.goto('/curriculum/T1_Foundational/F2D_Reusable_and_Parallel/');
    const labLink = page.getByRole('link', { name: /labs\/basics\/lab1_refactoring/i });
    await expect(labLink).toBeVisible();
    await expect(labLink).toHaveAttribute('href', '/labs/basics/lab1_refactoring/');
  });
});
