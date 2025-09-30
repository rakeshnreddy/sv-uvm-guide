import { test, expect } from '@playwright/test';
import { verificationStackLinks } from '@/components/diagrams/verification-stack-links';

const interactiveFlow = verificationStackLinks.filter(link => link.componentId);

// Only exercise a subset if the flow grows too large to keep the test snappy.
const nodesToCheck = interactiveFlow.slice(0, 5);

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test.describe('Interactive UVM architecture diagram', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/practice/visualizations/uvm-architecture');
    await page.getByTestId('uvm-flow-list').waitFor();
  });

  for (const node of nodesToCheck) {
    test(`selecting "${node.title}" updates the detail panel`, async ({ page }) => {
      const flowList = page.getByTestId('uvm-flow-list');
      const trigger = flowList.getByRole('button', { name: new RegExp(node.title, 'i') });
      await trigger.click();

      const detail = page.getByTestId('uvm-node-detail');
      await expect(detail.getByRole('heading', { level: 3, name: new RegExp(node.title, 'i') })).toBeVisible();
      await expect(detail).toContainText(node.insight ?? node.description);

      const cta = page.getByTestId('uvm-node-cta');
      await expect(cta).toHaveAttribute('href', new RegExp(`${escapeRegExp(node.href)}$`));
    });
  }

  test('quick summary cards stay in sync with the detail panel', async ({ page }) => {
    const summary = page.getByTestId('uvm-quick-summary');
    const targetNode = nodesToCheck.slice(-1)[0];

    const summaryCard = summary.getByRole('button', { name: new RegExp(targetNode.title, 'i') });
    await summaryCard.click();

    const detail = page.getByTestId('uvm-node-detail');
    await expect(detail.getByRole('heading', { level: 3, name: new RegExp(targetNode.title, 'i') })).toBeVisible();
  });
});
