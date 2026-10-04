import { test, expect } from '@playwright/test';

test.describe('F2 Revamp', () => {
  test('F2C hub surfaces Quick Take and chapter linking', async ({ page }) => {
    await page.goto('/curriculum/T1_Foundational/F2C_Procedural_Code_and_Flow_Control/index');

    await expect(page.getByRole('heading', { name: /Procedural Code and Flow Control/i })).toBeVisible();
    await expect(page.getByText('Quick Take')).toBeVisible();
    await expect(page.getByText('Timeline of a Simulation Tick')).toBeVisible();
    await expect(page.getByRole('link', { name: /Procedural Flow Control/ }).first()).toBeVisible();
  });

  test('F2A quick take pairs with explorer and quiz', async ({ page }) => {
    await page.goto('/curriculum/T1_Foundational/F2A_Core_Data_Types/index');

    await expect(page.getByText('Quick Take')).toBeVisible();
    const explorer = page.getByTestId('curriculum-data-type-explorer');
    await expect(explorer).toBeVisible();
    await expect(explorer.getByTestId('property-family')).toHaveText('Variable');

    const typePicker = explorer.getByRole('radiogroup', { name: 'Data type' });
    await typePicker.getByRole('radio', { name: 'wire [3:0]' }).click();
    await expect(explorer.getByTestId('property-family')).toHaveText('Net');

    // A net keeps all four values, so a single driver's x and z appear unchanged.
    await explorer.getByRole('button', { name: "Drive 4'b1x0z" }).click();
    await expect(explorer.getByTestId('value-readout')).toContainText("4'b1x0z");
    await expect(explorer.getByTestId('last-action-why')).toContainText('A net carries all four values');

    await expect(page.getByTestId('data-type-quiz')).toBeVisible();
  });

  test('F2B dynamic structures include the bounded queue lab', async ({ page }) => {
    await page.goto('/curriculum/T1_Foundational/F2B_Dynamic_Structures/index');

    await expect(page.getByText('Quick Take')).toBeVisible();
    const queueLab = page.getByRole('region', { name: 'Bounded queue comparison' });
    await expect(queueLab).toBeVisible();
    await expect(queueLab.getByRole('radio', { name: 'Urgent push_front' })).toHaveAttribute('aria-checked', 'true');

    // int bq[$:3] = '{1, 2, 3, 4}; bq.push_front(9); -> the old last item falls past the bound (§7.10.5).
    await queueLab.getByRole('radio', { name: "'{9, 1, 2, 3}", exact: true }).check();
    await queueLab.getByRole('button', { name: 'Lock in prediction' }).click();
    await expect(queueLab).toContainText('Correct.');
    await expect(queueLab).toContainText('int bq[$:3] · 1 warning');
    await expect(queueLab.getByRole('group', { name: 'q: [0] 9, [1] 1, [2] 2, [3] 3, [4] 4' }).first()).toBeVisible();
    await expect(
      queueLab.getByRole('group', { name: 'bq: [0] 9, [1] 1, [2] 2, [3] 3; bound $:3, room for 0 more; discarded 4' }),
    ).toBeVisible();

    // With room for five elements nothing overflows, so there is nothing to predict.
    await queueLab.getByRole('radio', { name: '[$:4] · 5 max' }).click();
    await expect(queueLab.getByRole('button', { name: 'Lock in prediction' })).toHaveCount(0);
    await expect(queueLab).toContainText('No step pushes bq past its bound');
    await expect(queueLab).toContainText('int bq[$:4] · 0 warnings');
  });

  test('F2D index keeps the sibling chapter reachable', async ({ page }) => {
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
    await page.goto('/curriculum/T1_Foundational/F2D_Reusable_Code_and_Parallelism/index');

    await expect(page.getByText('Quick Take')).toBeVisible();
    await expect(page.getByText('Interactive Example: The Logger')).toBeVisible();
    const ipcLink = page.getByRole('link', { name: /Interprocess Communication/ }).first();
    await expect(ipcLink).toBeVisible();
    await ipcLink.click();
    await expect(page).toHaveURL(/F2D_Reusable_Code_and_Parallelism\/ipc$/, { timeout: 15000 });
  });
});
