import { test, expect } from '@playwright/test';

test.describe('Foundational Lessons F1-F3', () => {


    test('F2: Data Types loads correctly', async ({ page }) => {
        await page.goto('/curriculum/T1_Foundational/F2A_Core_Data_Types');
        await expect(page.getByRole('heading', { name: /Core Data Types/i })).toBeVisible();
        // Check for interactive component if known, otherwise just heading
    });

    test('F3: Procedural Blocks loads correctly', async ({ page }) => {
        await page.goto('/curriculum/T1_Foundational/F3A_Procedural_Blocks_and_Flow_Control');
        await expect(page.getByRole('heading', { name: /Procedural Blocks and Flow Control/i })).toBeVisible();
        // Check for Event Region Game
        await expect(page.getByText('Event Region Scheduler')).toBeVisible();
    });

    test('F3: Flow Control loads correctly', async ({ page }) => {
        await page.goto('/curriculum/T1_Foundational/F3A_Procedural_Blocks_and_Flow_Control/flow-control');
        await expect(page.getByRole('heading', { name: /Procedural Flow Control/i })).toBeVisible();
    });

    test('F3: Fork-Join loads correctly', async ({ page }) => {
        await page.goto('/curriculum/T1_Foundational/F3C_Processes_and_Synchronization');
        await expect(page.getByRole('heading', { name: /Processes and Synchronization/i })).toBeVisible();
    });

    test('F3: Tasks & Functions loads correctly', async ({ page }) => {
        await page.goto('/curriculum/T1_Foundational/F3B_Tasks_and_Functions');
        await expect(page.getByRole('heading', { name: /Tasks and Functions/i })).toBeVisible();
    });
});

test.describe('General Site Health', () => {
    test('Home page loads', async ({ page }) => {
        await page.goto('/');
        await expect(page).toHaveTitle(/SystemVerilog/i);
        // Check for a known link or button. If 'Start Learning' is not there, check for 'Start Learning' or similar.
        // I will wait to see HeroSection content before finalizing this part, but for now I'll assume 'Start Learning' might be 'Start the Guide' or similar.
        // Let's use a more generic check for now or update after viewing HeroSection.
        await expect(page.getByRole('link', { name: 'Browse the curriculum' })).toBeVisible();
    });

    test('Navigation works', async ({ page }) => {
        await page.goto('/');
        await page.getByRole('link', { name: 'Browse the curriculum' }).click();
        await expect(page).toHaveURL(/curriculum/);
    });
});
