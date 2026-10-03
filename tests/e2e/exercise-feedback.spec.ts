import { test, expect } from '@playwright/test';

type AgentBuilderTestApi = {
  setAgentComponents(ids: string[]): void;
};

test.describe('Exercise Feedback Flow', () => {
  test('UVM Phase Sorter provides feedback and retry', async ({ page }) => {
    await page.goto('/exercises/uvm-phase-sorter');
    await page.getByRole('button', { name: 'Check Order' }).click();
    const feedback = page.getByTestId('exercise-feedback');
    await expect(feedback).toContainText('Score:');
    await page.getByRole('button', { name: /shuffle again/i }).click();
    await expect(feedback).toHaveCount(0);
  });

  test('Scoreboard Connector passes when connections are correct and can retry', async ({ page }) => {
    await page.goto('/exercises/scoreboard-connector');
    // Endpoint buttons are named "<reference in bus_env> (<role>, <type>)".
    const endpoint = (ref: string) =>
      page.getByRole('button', { name: new RegExp(`^${ref.replace(/\./g, '\\.')} \\(`) });
    const connect = async (from: string, to: string) => {
      await endpoint(from).click();
      await endpoint(to).click();
    };

    // A wrong-direction attempt is rejected with a why and is not recorded.
    await connect('scb.actual_fifo.analysis_export', 'agt.mon.ap');
    await expect(page.getByTestId('connect-verdict')).toContainText("Cannot call an imp port's connect method");

    await connect('agt.mon.ap', 'prd.analysis_export');
    await connect('agt.mon.ap', 'scb.actual_fifo.analysis_export');
    await connect('agt.mon.ap', 'cov.analysis_export');
    await connect('prd.ap', 'scb.expected_fifo.analysis_export');
    await page.getByRole('button', { name: 'Check wiring' }).click();
    const feedback = page.getByTestId('exercise-feedback');
    await expect(feedback).toContainText('Score: 100%');
    await expect(feedback).toContainText(/monitor stream, and only predictions reach the expected FIFO/i);
    await page.getByRole('button', { name: /reset board/i }).click();
    await expect(feedback).toHaveCount(0);
  });

  test('UVM Agent Builder evaluates components and resets on retry', async ({ page }) => {
    await page.goto('/exercises/uvm-agent-builder');
    const agentDrop = page.locator('#agent-droppable');
    await expect(agentDrop).toBeVisible();

    await page.waitForFunction(() => {
      return typeof window !== 'undefined' &&
        !!(window as typeof window & { __uvmAgentBuilderTest?: AgentBuilderTestApi }).__uvmAgentBuilderTest;
    });

    await page.evaluate(() => {
      (window as typeof window & {
        __uvmAgentBuilderTest?: AgentBuilderTestApi;
      }).__uvmAgentBuilderTest?.setAgentComponents(['sequencer', 'driver', 'monitor']);
    });

    await expect(agentDrop.locator('[role="listitem"]')).toHaveCount(3);

    await Promise.all([
      page.waitForSelector('[data-testid="exercise-feedback"]'),
      page.getByRole('button', { name: 'Check Agent' }).click(),
    ]);
    const feedback = page.getByTestId('exercise-feedback');
    await expect(feedback).toContainText('Score:');
    await page.getByRole('button', { name: 'Retry' }).click();
    await expect(feedback).toHaveCount(0);
  });
});
