import { test, expect } from '@playwright/test';

test.describe('F2 Revamp', () => {
  test('F2 hub surfaces Quick Take and learning path', async ({ page }) => {
    await page.goto('/curriculum/T1_Foundational/F2_Data_Types_and_Structures/');

    await expect(page.getByRole('heading', { name: 'F2: Data Types & Structures' })).toBeVisible();
    await expect(page.getByText('Quick Take')).toBeVisible();
    await expect(page.getByText('Value Systems')).toBeVisible();
    await expect(page.getByText('Structures That Flex')).toBeVisible();
    await expect(page.getByRole('link', { name: /Core Data Types/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Dynamic Structures/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Operators/ })).toBeVisible();
  });

  test('F2A quick take pairs with explorer and quiz', async ({ page }) => {
    await page.goto('/curriculum/T1_Foundational/F2A_Core_Data_Types/');

    await expect(page.getByText('Quick Take')).toBeVisible();
    const explorer = page.getByTestId('curriculum-data-type-explorer');
    await expect(explorer).toBeVisible();
    await expect(explorer.getByTestId('property-family')).toHaveText('Variable');
    await explorer.getByTestId('select-wire').click();
    await expect(explorer.getByTestId('property-family')).toHaveText('Net');

    await expect(page.getByTestId('data-type-quiz')).toBeVisible();
  });

  test('F2B dynamic structures include queue lab and packed playground', async ({ page }) => {
    await page.goto('/curriculum/T1_Foundational/F2B_Dynamic_Structures/');

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

  test('F2C operator drills highlight precedence and equality', async ({ page }) => {
    await page.goto('/curriculum/T1_Foundational/F2C_Operators_and_Expressions/');

    await expect(page.getByText('Quick Take')).toBeVisible();
    const drill = page.getByTestId('operator-drill');
    await expect(drill).toBeVisible();
    await page.getByRole('tab', { name: /Case Equality/ }).click();
    await expect(page.getByTestId('drill-expression')).toContainText('Case Equality');
    await page.getByRole('tab', { name: /Streaming Concatenation/ }).click();
    await expect(page.getByTestId('drill-result')).toContainText("16'hA55A");
  });
});
