import { test, expect } from '@playwright/test';

test.describe('Tier 1 F2 micro-lessons', () => {
  test('F2A data type explorer and quiz respond to interactions', async ({ page }) => {
    await page.goto('/curriculum/T1_Foundational/F2A_Core_Data_Types/');

    const explorer = page.getByTestId('curriculum-data-type-explorer');
    await expect(explorer).toBeVisible();
    await expect(explorer.getByTestId('property-family')).toHaveText('Variable');

    await explorer.getByTestId('select-wire').click();
    await expect(explorer.getByTestId('property-family')).toHaveText('Net');
    const firstWireBit = explorer.getByTestId('bit-0');
    await expect(firstWireBit).toHaveText('Z');
    await firstWireBit.click();
    await expect(firstWireBit).toHaveText('0');
    await expect(explorer.getByTestId('hardware-label')).toContainText('interconnect');

    const quiz = page.getByTestId('data-type-quiz');
    await expect(quiz).toBeVisible();

    const quizFlow: Array<{ answer: string; continueLabel: RegExp }> = [
      { answer: 'wire [31:0] shared_bus;', continueLabel: /next scenario/i },
      { answer: 'bit [15:0] count;', continueLabel: /next scenario/i },
      { answer: 'Two procedural blocks are driving the same signal with different values.', continueLabel: /next scenario/i },
      { answer: 'int latency_delta;', continueLabel: /next scenario/i },
      { answer: 'logic ready;', continueLabel: /see results/i },
    ];

    for (const step of quizFlow) {
      await quiz.getByText(step.answer, { exact: true }).click();
      await expect(page.getByTestId('quiz-feedback')).toContainText('Correct');
      await quiz.getByRole('button', { name: step.continueLabel }).click();
    }

    const rewardModal = page.getByTestId('quiz-reward-modal');
    await expect(rewardModal).toBeVisible();
    await expect(rewardModal).toContainText('+150 XP');

    await page.getByRole('button', { name: /close/i }).click();
    await expect(page.getByTestId('quiz-reward-modal')).toHaveCount(0);
  });

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
