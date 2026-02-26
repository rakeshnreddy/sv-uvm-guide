import { test, expect } from '@playwright/test';

test.describe('Phase 9 Visualizations', () => {

    test('OperatorVisualizer in F2C renders and interacts', async ({ page }) => {
        await page.goto('/curriculum/T1_Foundational/F2C_Operators_and_Expressions');

        // Check title
        await expect(page.getByRole('heading', { name: 'F2C: Operators and Expressions' })).toBeVisible();

        // Check Visualizer presence
        const visualizer = page.getByTestId('operator-visualizer');
        await expect(visualizer).toBeVisible();

        // Interact: Click OR button (|)
        await visualizer.getByRole('button', { name: '|', exact: true }).click();

        // Check explanation update
        await expect(visualizer).toContainText('Bitwise OR: Result is 1 if either bit is 1');
    });

    test('ArrayMethodExplorer in F2B renders and interacts', async ({ page }) => {
        await page.goto('/curriculum/T1_Foundational/F2B_Dynamic_Structures');

        // Check Visualizer presence
        const visualizer = page.getByTestId('array-method-explorer');
        await expect(visualizer).toBeVisible();

        // Interact: Click sort()
        // Interact: Click sort()
        await visualizer.locator('button').filter({ hasText: 'sort()' }).first().click({ force: true });

        // Check result text
        await expect(visualizer).toContainText('Array sorted in ascending order');
    });

    test('MailboxSemaphoreGame in F3D renders and switches modes', async ({ page }) => {
        await page.goto('/curriculum/T1_Foundational/F3C_Processes_and_Synchronization/ipc');

        // Check Visualizer presence
        const visualizer = page.getByTestId('mailbox-semaphore-game');
        await expect(visualizer).toBeVisible();

        // Interact: Switch to Mailbox mode
        await visualizer.getByRole('button', { name: 'Mailbox' }).click();

        // Check title change
        await expect(visualizer).toContainText('Mailbox (Data Flow)');

        // Interact: Put mail
        await visualizer.getByRole('button', { name: 'Put()' }).click();
        await expect(visualizer).toContainText('Producer put data');
    });

});
