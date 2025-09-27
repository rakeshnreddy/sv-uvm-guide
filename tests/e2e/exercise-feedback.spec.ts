import { test, expect } from '@playwright/test';

test.describe('Exercise Feedback Flow', () => {
  test('UVM Phase Sorter provides feedback and retry', async ({ page }) => {
    await page.goto('/exercises/uvm-phase-sorter');
    await page.getByRole('button', { name: 'Check Order' }).click();
    const feedback = page.locator('[role="status"]');
    await expect(feedback).toContainText('Score:');
    await page.getByRole('button', { name: /shuffle again/i }).click();
    await expect(feedback).toHaveCount(0);
  });

  test('Scoreboard Connector passes when connections are correct and can retry', async ({ page }) => {
    await page.goto('/exercises/scoreboard-connector');
    await page.getByLabel('Port trans_ap on UVM Monitor').click();
    await page.getByLabel('Port actual_trans_imp on Scoreboard').click();
    await page.getByLabel('Port trans_ap on UVM Monitor').click();
    await page.getByLabel('Port observed_trans_imp on Coverage Collector').click();
    await page.getByRole('button', { name: 'Check Connections' }).click();
    const feedback = page.locator('[role="status"]');
    await expect(feedback).toContainText('Score: 100%');
    await expect(feedback).toContainText(/scoreboard and coverage collector both receive the monitor stream/i);
    await page.getByRole('button', { name: /reset board/i }).click();
    await expect(feedback).toHaveCount(0);
  });

  test('UVM Agent Builder evaluates components and resets on retry', async ({ page }) => {
    await page.goto('/exercises/uvm-agent-builder');
    const agentDrop = page.locator('#agent-droppable');
    await page.getByText('Sequencer').dragTo(agentDrop);
    await page.getByText('Driver').dragTo(agentDrop);
    await page.getByText('Monitor').dragTo(agentDrop);
    await page.getByRole('button', { name: 'Check Agent' }).click();
    const feedback = page.locator('[role="status"]');
    await expect(feedback).toContainText('Score:');
    await page.getByRole('button', { name: 'Retry' }).click();
    await expect(feedback).toHaveCount(0);
  });
});
