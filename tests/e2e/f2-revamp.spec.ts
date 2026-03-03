import { test, expect } from '@playwright/test';

test.describe('F2 Revamp', () => {
  test('F2C hub surfaces Quick Take and chapter linking', async ({ page }) => {
    await page.goto('/curriculum/T1_Foundational/F2C_Procedural_Code_and_Flow_Control/index');

    await expect(page.getByRole('heading', { name: /Procedural Blocks and Flow Control/i })).toBeVisible();
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
    await explorer.getByTestId('select-wire').click();
    await expect(explorer.getByTestId('property-family')).toHaveText('Net');

    await expect(page.getByTestId('data-type-quiz')).toBeVisible();
  });

  test('F2B dynamic structures include queue lab and packed playground', async ({ page }) => {
    await page.goto('/curriculum/T1_Foundational/F2B_Dynamic_Structures/index');

    await expect(page.getByText('Quick Take')).toBeVisible();
    const queueLab = page.getByTestId('queue-operation-lab');
    await expect(queueLab).toBeVisible();
    await page.getByTestId('queue-lab-value').fill('101');
    await page.getByTestId('queue-lab-push-back').click();
    await expect(page.getByTestId('queue-lab-state')).toContainText('depth 5');
    await page.getByTestId('queue-lab-pop-front').click();
    await expect(page.getByTestId('queue-lab-state')).toContainText('depth 4');

    const packedPlayground = page.getByTestId('packed-unpacked-playground');
    await expect(packedPlayground).toBeVisible();
    await page.getByTestId('packed-unpacked-lane-matrix').click();
    await expect(page.getByTestId('packed-unpacked-scenario')).toContainText('Lane Matrix');
    await page.getByTestId('packed-unpacked-next').click();
    await expect(page.getByTestId('packed-unpacked-step')).not.toHaveText('');
  });

  test('F2D index keeps the sibling chapter reachable', async ({ page }) => {
    await page.goto('/curriculum/T1_Foundational/F2D_Reusable_Code_and_Parallelism/index');

    await expect(page.getByText('Quick Take')).toBeVisible();
    await expect(page.getByText('Interactive Example: The Logger')).toBeVisible();
    const ipcLink = page.getByRole('link', { name: /Interprocess Communication/ }).first();
    await expect(ipcLink).toBeVisible();
    await ipcLink.click();
    await expect(page).toHaveURL(/F2D_Reusable_Code_and_Parallelism\/ipc$/);
  });
});
