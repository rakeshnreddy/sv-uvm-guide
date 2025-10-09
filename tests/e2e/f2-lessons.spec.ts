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
    const visualizer = page.getByTestId('dynamic-structure-visualizer');
    await expect(visualizer).toBeVisible();

    await page.getByTestId('dynamic-array-input').fill('72');
    await page.getByTestId('dynamic-array-push').click();
    await expect(page.getByTestId('dynamic-array-info')).toContainText('size()4');
    await page.getByTestId('dynamic-array-resize-input').fill('6');
    await page.getByTestId('dynamic-array-resize').click();
    await expect(page.getByTestId('dynamic-array-info')).toContainText('sum()');

    await page.getByTestId('tab-queue').click();
    await page.getByTestId('queue-bounded-switch').click();
    await page.getByTestId('queue-bound-input').fill('3');
    await page.getByTestId('queue-push').click();
    await expect(page.getByTestId('queue-warning')).toContainText('Queue Full');
    await page.getByTestId('queue-pop').click();
    await page.getByTestId('queue-bounded-switch').click();
    await page.getByTestId('queue-input').fill('260');
    await page.getByTestId('queue-push-front').click();
    await page.getByTestId('queue-index').fill('1');
    await page.getByTestId('queue-insert').click();
    await expect(page.getByTestId('queue-info')).toContainText('insert(1)');
    await page.getByTestId('queue-delete').click();
    await expect(page.getByTestId('queue-info')).toContainText('delete(1)');

    await page.getByTestId('tab-associative').click();
    await page.getByTestId('associative-key').fill('packet_1300');
    await page.getByTestId('associative-value').fill('DONE');
    await page.getByTestId('associative-add').click();
    await expect(page.getByTestId('associative-count')).toContainText('3');

    await page.getByTestId('tab-packed').click();
    await expect(page.getByTestId('packed-scenario-title')).toContainText('Burst Payload');
    await expect(page.getByTestId('packed-advance')).toBeDisabled();
    await page.getByTestId('packed-option-packed-bit-position').click();
    await expect(page.getByTestId('packed-feedback')).toContainText('Correct');
    await expect(page.getByTestId('packed-advance')).toBeEnabled();
    await page.getByTestId('packed-advance').click();

    const game = page.getByTestId('packet-sorter-game');
    await expect(game).toBeVisible();

    const packetFlow: Array<{ prompt: RegExp; option: string }> = [
      { prompt: /100 packets/i, option: 'packet-option-queue' },
      { prompt: /error packets/i, option: 'packet-option-associative-array' },
      { prompt: /packet lengths/i, option: 'packet-option-dynamic-array' },
      { prompt: /register mirror/i, option: 'packet-option-packed-array' },
      { prompt: /diagnostics bursts/i, option: 'packet-option-queue' },
    ];

    for (const step of packetFlow) {
      await expect(page.getByTestId('packet-sorter-prompt')).toContainText(step.prompt);
      await page.getByTestId(step.option).click();
      await expect(page.getByTestId('packet-sorter-feedback')).toContainText('Correct');
      await page.getByTestId('packet-next').click();
    }

    const rewardModal = page.getByTestId('packet-sorter-modal');
    await expect(rewardModal).toBeVisible();
    await expect(rewardModal).toContainText('+150 XP');
    await page.evaluate(() => {
      const button = document.querySelector('[data-testid="packet-modal-close"]') as HTMLButtonElement | null;
      button?.click();
    });
    await expect(page.getByTestId('packet-sorter-modal')).toHaveCount(0);
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
