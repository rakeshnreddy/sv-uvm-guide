import { test, expect } from '@playwright/test';

test.describe('F4 Lessons', () => {
    test('F4A: Modules and Packages loads correctly', async ({ page }) => {
        await page.goto('/curriculum/T1_Foundational/F4A_Modules_and_Packages');
        await expect(page.getByRole('heading', { name: 'F4A: Structuring Designs with Modules and Packages' })).toBeVisible();
        await expect(page.getByText('The fundamental building blocks of SystemVerilog')).toBeVisible();
    });

    test('F4B: Interfaces and Modports loads correctly', async ({ page }) => {
        await page.goto('/curriculum/T1_Foundational/F4B_Interfaces_and_Modports');
        // Debug: Print title to see if page loaded
        console.log('Page Title:', await page.title());

        try {
            await expect(page.getByRole('heading', { name: 'F4B: Bundling Signals with Interfaces and Modports' })).toBeVisible({ timeout: 5000 });
        } catch (e) {
            console.log('Heading not found. Page content snippet:');
            console.log((await page.content()).slice(0, 1000));
            throw e;
        }
        await expect(page.getByText('Modport Explorer')).toBeVisible();
    });

    test('F4C: Clocking Blocks loads correctly', async ({ page }) => {
        await page.goto('/curriculum/T1_Foundational/F4C_Clocking_Blocks');
        await expect(page.getByRole('heading', { name: 'F4C: Synchronizing with Clocking and Program Blocks' })).toBeVisible();
        await expect(page.getByText('The Race Condition Problem')).toBeVisible();
    });
});
