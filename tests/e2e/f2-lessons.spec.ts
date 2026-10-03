import { test, expect } from '@playwright/test';

test.describe('Tier 1 F2 micro-lessons', () => {
  test('F2A data type explorer and quiz respond to interactions', async ({ page }) => {
    await page.goto('/curriculum/T1_Foundational/F2A_Core_Data_Types/');

    const explorer = page.getByTestId('curriculum-data-type-explorer');
    await expect(explorer).toBeVisible();
    await expect(explorer.getByTestId('property-family')).toHaveText('Variable');

    // An undriven net floats at z; activating a bit cycles 0 -> 1 -> x -> z.
    const typePicker = explorer.getByRole('radiogroup', { name: 'Data type' });
    await typePicker.getByRole('radio', { name: 'wire [3:0]' }).click();
    await expect(typePicker.getByRole('radio', { name: 'wire [3:0]' })).toHaveAttribute('aria-checked', 'true');
    await expect(explorer.getByTestId('property-family')).toHaveText('Net');
    await expect(explorer.getByTestId('value-readout')).toContainText("4'bzzzz");
    const msb = explorer.getByRole('group', { name: 'wire [3:0] bits' }).getByRole('button').first();
    await expect(msb).toHaveAccessibleName('Bit 3 is z');
    await msb.click();
    await expect(msb).toHaveAccessibleName('Bit 3 is 0');
    await expect(explorer.getByTestId('hardware-label')).toContainText('interconnect');

    // Writing 4'b1x0z into a 2-state int turns x and z into 0, leaving 4'b1000 = 8 (§6.11.2).
    await typePicker.getByRole('radio', { name: 'int', exact: true }).click();
    await expect(explorer.getByTestId('property-value-system')).toHaveText('2-state');
    await explorer.getByRole('button', { name: "Write 4'b1x0z" }).click();
    await expect(explorer.getByTestId('value-readout')).toContainText('8 (signed)');
    await expect(explorer.getByTestId('last-action-why')).toContainText('Bits 2, 0 became 0');

    const quiz = page.getByTestId('data-type-quiz');
    await expect(quiz).toBeVisible();

    const quizFlow: Array<{ answer: string; continueLabel: RegExp }> = [
      { answer: 'wire [31:0] shared_bus;', continueLabel: /next scenario/i },
      { answer: 'logic [15:0] count;', continueLabel: /next scenario/i },
      { answer: 'Nothing in the reset branch assigns it, so it still holds its starting value of x.', continueLabel: /next scenario/i },
      { answer: 'int latency_delta;', continueLabel: /next scenario/i },
      { answer: 'logic ready;', continueLabel: /see results/i },
    ];

    for (const step of quizFlow) {
      await quiz.getByRole('button', { name: step.answer, exact: true }).click();
      await expect(quiz.getByTestId('quiz-feedback')).toContainText('Correct!');
      await quiz.getByRole('button', { name: step.continueLabel }).click();
    }

    await expect(quiz).toContainText('You scored 5 / 5');
    const rewardDialog = page.getByRole('dialog', { name: 'Success!' });
    await expect(rewardDialog).toBeVisible();
    await expect(rewardDialog).toContainText('+150 XP');

    await rewardDialog.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('dialog', { name: 'Success!' })).toHaveCount(0);
  });

  test('F2B dynamic structures explorer responds to interactions', async ({ page }) => {
    await page.goto('/curriculum/T1_Foundational/F2B_Dynamic_Structures/');

    const lab = page.getByRole('region', { name: 'Container lab' });
    await expect(lab).toBeVisible();
    const structure = lab.getByRole('radiogroup', { name: 'Structure' });
    const operations = lab.getByRole('group', { name: 'Operations' });

    // Dynamic array: new[N](old) copies the old elements and pads with the 4-state default x (§7.5.1).
    await expect(lab.getByRole('group', { name: 'buffer: [0] 0, [1] 10, [2] 20, [3] 30' })).toBeVisible();
    await operations.getByRole('button', { name: 'buffer = new[6](buffer)' }).click();
    await lab.getByRole('radio', { name: "'{x, x}", exact: true }).check();
    await lab.getByRole('button', { name: 'Lock in prediction' }).click();
    await expect(lab).toContainText('Correct. The old elements are copied and the rest is padded with the type default');
    await lab.getByRole('button', { name: /Apply and continue/ }).click();
    await expect(lab.getByRole('group', { name: 'buffer: [0] 0, [1] 10, [2] 20, [3] 30, [4] x, [5] x' })).toBeVisible();
    await expect(lab).toContainText('size() = 6');

    // Bounded queue: a push_back past [$:3] is written, then discarded with a required warning (§7.10.5).
    await structure.getByRole('radio', { name: 'Queue' }).click();
    await expect(lab.getByRole('radiogroup', { name: 'Queue declaration' }).getByRole('radio', { name: 'int q[$:3]' })).toHaveAttribute('aria-checked', 'true');
    await operations.getByRole('button', { name: 'q.push_back(5)' }).click();
    await expect(lab.getByRole('group', { name: 'q: [0] 10, [1] 20, [2] 30, [3] 5; bound $:3, room for 0 more' })).toBeVisible();
    await operations.getByRole('button', { name: 'q.push_back(5)' }).click();
    await lab.getByRole('radio', { name: "'{10, 20, 30, 5}", exact: true }).check();
    await lab.getByRole('button', { name: 'Lock in prediction' }).click();
    await expect(lab).toContainText('Correct.');
    await expect(lab.getByRole('list', { name: 'Diagnostics' }).first()).toContainText("Bound $:3 exceeded: discarded '{5}");
    await lab.getByRole('button', { name: /Apply and continue/ }).click();
    await expect(lab.getByRole('group', { name: 'q: [0] 10, [1] 20, [2] 30, [3] 5; bound $:3, room for 0 more; discarded 5' })).toBeVisible();

    // Associative array: first() follows index order (uppercase before lowercase), not write order (§7.9.4).
    await structure.getByRole('radio', { name: 'Associative array' }).click();
    await operations.getByRole('button', { name: 'scores["eve"] = 5' }).click();
    await expect(lab).toContainText('num() = 4');
    await operations.getByRole('button', { name: 'found = scores.first(key)' }).click();
    await lab.getByRole('radio', { name: '"Gamma"', exact: true }).check();
    await lab.getByRole('button', { name: 'Lock in prediction' }).click();
    await expect(lab).toContainText('Correct.');
    await lab.getByRole('button', { name: /Apply and continue/ }).click();
    await expect(lab.getByTestId('container-result')).toContainText('first() sets key to the smallest index, "Gamma"');

    const game = page.getByRole('region', { name: 'Structure choice practice' });
    await expect(game).toBeVisible();

    const packetFlow: Array<{ prompt: RegExp; option: string }> = [
      { prompt: /processed in arrival order/i, option: 'Queue' },
      { prompt: /error packets/i, option: 'Associative array' },
      { prompt: /packet length/i, option: 'Queue' },
      { prompt: /N lanes/i, option: 'Dynamic array' },
      { prompt: /at most 8 pending items/i, option: 'item_t buf[$:7]' },
      { prompt: /register mirror/i, option: 'logic [3:0][7:0] mirror' },
    ];
    for (const step of packetFlow) {
      await expect(game.getByTestId('packet-sorter-prompt')).toContainText(step.prompt);
      await game.getByRole('group', { name: 'Options' }).getByRole('button', { name: step.option, exact: true }).click();
      await expect(game.getByTestId('packet-sorter-feedback')).toContainText('Correct.');
      await game.getByTestId('packet-next').click();
    }

    await expect(game.getByTestId('packet-score')).toHaveText('You chose the best structure in 6 of 6 scenarios.');
  });
});
