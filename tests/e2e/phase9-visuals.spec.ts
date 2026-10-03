import { test, expect } from '@playwright/test';

test.describe('Phase 9 Visualizations', () => {

    test('EventRegionGame in F2C renders and interacts', async ({ page }) => {
        page.on('console', async msg => {
            if (msg.type() === 'error' && msg.text().includes('Error')) {
                const text = msg.text();
                if (text.includes('Error creating WebGL context') || text.includes('customDepthMaterial') || text.includes('Expected length') || text.includes('404')) {
                    return; // Ignore benign/known framework errors
                }
                const args = await Promise.all(msg.args().map(a => a.jsonValue().catch(() => '')));
                throw new Error(`BROWSER CONSOLE ERROR: ${msg.text()} | Args: ${JSON.stringify(args)}`);
            }
        });
        page.on('pageerror', error => {
            const msg = error.message;
            if (!msg.includes('Error creating WebGL context') &&
                !msg.includes('Hydration failed') &&
                !msg.includes('error while hydrating')) {
                throw new Error(`UNCAUGHT BROWSER ERROR: ${msg}`);
            }
        });
        await page.goto('/curriculum/T1_Foundational/F2C_Procedural_Code_and_Flow_Control/index');

        // Check title
        await expect(page.getByRole('heading', { name: /Procedural Code and Flow Control/i })).toBeVisible();

        // Start the challenge and answer the first prompt
        const startButton = page.getByRole('button', { name: 'Start Challenge' });
        await expect(startButton).toBeVisible();
        await startButton.click();
        await page.getByRole('button', { name: /^Active/i }).click();
        await expect(page.getByText('Correct!')).toBeVisible();
    });

    test('ArrayMethodExplorer in F2B renders and interacts', async ({ page }) => {
        await page.goto('/curriculum/T1_Foundational/F2B_Dynamic_Structures/index');

        const explorer = page.getByRole('region', { name: 'Array method explorer' });
        await expect(explorer).toBeVisible();

        // Pick an ordering method: sort() is a void method that reorders data in place (§7.12.2).
        await explorer.getByRole('radiogroup', { name: 'Method family' }).getByRole('radio', { name: 'Reorder (void, in place)' }).click();
        const sortMethod = explorer.getByRole('radiogroup', { name: 'Method', exact: true }).getByRole('radio', { name: 'sort()', exact: true });
        await expect(sortMethod).toHaveAttribute('aria-checked', 'true');

        // Predict first, then the model reveals the result.
        await explorer.getByRole('radio', { name: "data = '{4, 8, 8, 15, 15, 23, 99, 200}", exact: true }).check();
        await explorer.getByRole('button', { name: 'Lock in prediction' }).click();
        await expect(explorer).toContainText('Correct. Array sorted in ascending order');
        await expect(explorer.getByTestId('array-method-result')).toHaveText("data = '{4, 8, 8, 15, 15, 23, 99, 200}");
        await expect(
            explorer.getByRole('group', { name: 'data after: [0] 4, [1] 8, [2] 8, [3] 15, [4] 15, [5] 23, [6] 99, [7] 200' }),
        ).toBeVisible();
    });

    test('MailboxSemaphoreGame in F3D renders and switches modes', async ({ page }) => {
        await page.goto('/curriculum/T1_Foundational/F2D_Reusable_Code_and_Parallelism/ipc');

        const game = page.getByRole('region', { name: 'Mailbox and semaphore lab' });
        await expect(game).toBeVisible();

        // Switch the lab to mailbox mode.
        const labPicker = game.getByRole('radiogroup', { name: 'Lab' });
        await labPicker.getByRole('radio', { name: 'Mailbox', exact: true }).click();
        await expect(labPicker.getByRole('radio', { name: 'Mailbox', exact: true })).toHaveAttribute('aria-checked', 'true');
        await expect(game.getByRole('heading', { name: 'Mailboxes: bounded queues that block' })).toBeVisible();

        // Scripted run on new(2): messages 0 and 1 fill the mailbox, so put(2) waits for the consumer's first get at 10 ns.
        await game.getByRole('radiogroup', { name: 'Mailbox program' }).getByRole('radio', { name: 'new(2)' }).click();
        await expect(game.getByRole('list', { name: 'Code (generated from the model)' })).toContainText('mailbox #(int) mbx = new(2);');
        await game.getByRole('radio', { name: 't = 10 ns', exact: true }).check();
        await game.getByRole('button', { name: 'Lock in prediction' }).click();
        await expect(game).toContainText('Correct. Right: 0 and 1 fill the mailbox and put(2) blocks.');

        // Sandbox: a consumer blocked in get() on an empty mailbox wakes by itself when the producer puts.
        const sandbox = game.getByRole('region', { name: 'Mailbox sandbox' });
        const consumerGet = sandbox.getByRole('button', { name: 'consumer 1: mbx.get(v)' });
        await consumerGet.click();
        await expect(consumerGet).toBeDisabled();
        await expect(consumerGet).toHaveAccessibleDescription(/blocked in mbx\.get\(v\)/);
        await sandbox.getByRole('button', { name: 'producer: mbx.put(1)', exact: true }).click();
        await expect(consumerGet).toBeEnabled();
        await expect(consumerGet).toHaveAccessibleDescription(/v = 1/);
        await expect(sandbox).toContainText('consumer 1 wakes by itself with v = 1');
    });

});
