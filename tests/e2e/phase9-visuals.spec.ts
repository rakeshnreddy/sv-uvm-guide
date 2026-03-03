import { test, expect } from '@playwright/test';

test.describe('Phase 9 Visualizations', () => {

    test('EventRegionGame in F2C renders and interacts', async ({ page }) => {
        await page.goto('/curriculum/T1_Foundational/F2C_Procedural_Code_and_Flow_Control');

        // Check title
        await expect(page.getByRole('heading', { name: /Procedural Blocks and Flow Control/i })).toBeVisible();

        // Start the challenge and answer the first prompt
        const startButton = page.getByRole('button', { name: 'Start Challenge' });
        await expect(startButton).toBeVisible();
        await startButton.click();
        await page.getByRole('button', { name: /Active/i }).click();
        await expect(page.getByText('Correct!')).toBeVisible();
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
        await page.goto('/curriculum/T1_Foundational/F2D_Reusable_Code_and_Parallelism/ipc');

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
